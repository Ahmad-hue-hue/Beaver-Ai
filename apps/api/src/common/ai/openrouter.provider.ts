import { Injectable, Logger } from '@nestjs/common';
import type {
  AiProvider,
  ChatMessage,
  CompleteOptions,
  CompleteResult,
  ToolCall,
} from './ai.provider.js';

/**
 * Free-tier catalog snapshot returned by OpenRouter's /models endpoint.
 * `general` holds free, function-calling-capable chat models; `vision` the
 * subset of those that also accept image input.
 */
export interface FreeModelCatalog {
  general: string[];
  vision: string[];
}

/**
 * Pure filter over a raw list of OpenRouter model records. Picks only free
 * chat models that support function/tool calling (the agent needs `tools`),
 * splitting out the vision-capable ones. Works on the same shape as
 * `GET https://openrouter.ai/api/v1/models`.
 */
export function filterFreeModels(
  records: Array<{
    id?: string;
    supported_parameters?: string[] | null;
    architecture?: { input_modalities?: string[] | null } | null;
  }>,
): FreeModelCatalog {
  const general: string[] = [];
  let vision: string[] = [];

  for (const m of records) {
    if (!m || typeof m !== 'object') continue;
    const id = m.id;
    if (!id || !id.endsWith(':free')) continue;
    const params = m.supported_parameters ?? [];
    const supportsTools = params.includes('tools') || params.includes('function_call');
    if (!supportsTools) continue;
    if (!general.includes(id)) general.push(id);
    const modalities = m.architecture?.input_modalities ?? [];
    if (modalities.includes('image') && !vision.includes(id)) {
      vision = [...vision, id];
    }
  }

  return { general, vision };
}

// Free-model catalog rotates on OpenRouter with no notice; re-resolve it at
// least this often so a stale but still-listed slug doesn't block fallbacks.
const FREE_CATALOG_TTL_MS = 30 * 60 * 1000;

/**
 * OpenRouter AI provider — OpenAI-compatible endpoint at
 * https://openrouter.ai/api/v1/chat/completions with Bearer auth.
 *
 * Model IDs follow the `provider/model-name` format, e.g.
 *   minimax/minimax-m3:free      (primary agent / function-calling)
 *   minimax/minimax-m2.7:free    (fallback + vision)
 *
 * NOTE: `:free` slugs disappear and reappear on OpenRouter continuously
 * (they then return 404 "This model is unavailable for free"). The provider
 * therefore appends the *live* free-model catalog (tool-capable, and
 * vision-capable when the request carries images) as rotating fallbacks, so a
 * dead env-configured slug degrades into whatever free model works right now
 * instead of failing the whole turn.
 */
@Injectable()
export class OpenRouterAiProvider implements AiProvider {
  readonly name = 'openrouter';
  readonly isLive = true;

  private readonly logger = new Logger(OpenRouterAiProvider.name);
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  // Process-lifetime cache: one catalog fetch per TTL window, shared by all turns.
  private static catalogCache: { fetchedAt: number; catalog: FreeModelCatalog } | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly maxTokens: number,
    private readonly visionModel?: string,
    private readonly fallbackModel?: string,
  ) {}

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const maxTokens = opts.maxOutputTokens ?? this.maxTokens;
    const imagesPresent = opts.messages.some((m) => m.images && m.images.length > 0);
    const model = imagesPresent && this.visionModel ? this.visionModel : this.model;

    const messages = opts.messages.map((m, idx) => this.toWire(m, idx));

    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature: opts.temperature ?? 0.7,
    };
    if (opts.tools && opts.tools.length > 0) payload.tools = opts.tools;

    // Candidate queue: env-configured primary + fallback first (they are the
    // operator's explicit choice), then the live free catalog as rotating
    // safety net for when those slugs are dead or overloaded.
    const candidates = [
      model,
      ...(this.fallbackModel && this.fallbackModel !== model ? [this.fallbackModel] : []),
      ...(imagesPresent
        ? (await this.freeCatalog()).vision
        : (await this.freeCatalog()).general),
    ].filter((id, idx, all) => id && all.indexOf(id) === idx);

    // Free-tier providers transiently overload; try the primary model, then
    // fall back to the remaining candidates, retrying transient failures a few
    // times with backoff. A definitive error (e.g. invalid model ID → 400)
    // moves on to the next candidate immediately.
    const maxTransient = 3;

    let lastError: unknown = new Error('AI provider failed after retries.');
    for (const candidate of candidates) {
      payload.model = candidate;
      let transientFailures = 0;
      while (transientFailures < maxTransient) {
        try {
          const res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const body = await res.text().catch(() => '');
            this.logger.error(`OpenRouter ${res.status} (${candidate}): ${body.slice(0, 300)}`);
            const transient = res.status === 429 || res.status >= 500;
            if (!transient) {
              lastError = new Error(`AI provider returned HTTP ${res.status} for ${candidate}`);
              break;
            }
            transientFailures++;
            await this.sleep(transientFailures * 900);
            continue;
          }

          const data = (await res.json()) as {
            choices?: { message: { tool_calls?: unknown; content?: string | null } }[];
            error?: { message?: string };
          };

          if (!data.choices?.length || data.error) {
            const upstreamMessage = data.error?.message ?? 'AI provider returned no choices.';
            if (this.isTransient(upstreamMessage) && transientFailures < maxTransient - 1) {
              this.logger.warn(`Transient upstream error, retrying: ${upstreamMessage}`);
              transientFailures++;
              await this.sleep(transientFailures * 900);
              continue;
            }
            lastError = new Error(upstreamMessage);
            break;
          }

          const message = data.choices[0]?.message;
          const toolCalls = this.parseToolCalls(message?.tool_calls);
          return {
            text: (message?.content ?? '').trim(),
            toolCalls,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (this.isTransient(message) && transientFailures < maxTransient - 1) {
            this.logger.warn(`Transient error, retrying: ${message}`);
            transientFailures++;
            await this.sleep(transientFailures * 900);
            continue;
          }
          lastError = err;
          break;
        }
      }
    }
    this.logger.error(`AI completion failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
    throw lastError;
  }

  /** Convert our ChatMessage into an OpenAI wire message, attaching prior tool calls. */
  private toWire(m: ChatMessage, idx: number): Record<string, unknown> {
    switch (m.role) {
      case 'tool':
        return { role: 'tool', tool_call_id: m.name ?? '', content: m.content.trim() };
      case 'assistant':
        if (m.toolCalls && m.toolCalls.length > 0) {
          return {
            role: 'assistant',
            content: m.content.trim() || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            })),
          };
        }
        return { role: 'assistant', content: m.content.trim() };
      case 'user': {
        if (m.images && m.images.length > 0) {
          return {
            role: 'user',
            content: [
              { type: 'text', text: m.content.trim() },
              ...m.images.map((src) => ({ type: 'image_url', image_url: { url: src } })),
            ],
          };
        }
        return { role: 'user', content: m.content.trim() || `${idx}` };
      }
      default:
        return { role: 'system', content: m.content.trim() };
    }
  }

  /**
   * Live free-model catalog, cached per process for a short window. Failures
   * degrade to an empty list — the env models alone still get tried.
   */
  private async freeCatalog(): Promise<FreeModelCatalog> {
    const now = Date.now();
    if (
      OpenRouterAiProvider.catalogCache &&
      now - OpenRouterAiProvider.catalogCache.fetchedAt < FREE_CATALOG_TTL_MS
    ) {
      return OpenRouterAiProvider.catalogCache.catalog;
    }

    const catalog = await this.fetchFreeCatalog();
    OpenRouterAiProvider.catalogCache = { fetchedAt: now, catalog };
    return catalog;
  }

  private async fetchFreeCatalog(): Promise<FreeModelCatalog> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      if (!res.ok) return { general: [], vision: [] };
      const data = (await res.json()) as { data?: unknown };
      const raw = Array.isArray(data.data) ? data.data : [];
      return filterFreeModels(
        raw as Array<{
          id?: string;
          supported_parameters?: string[] | null;
          architecture?: { input_modalities?: string[] | null } | null;
        }>,
      );
    } catch {
      this.logger.warn('Failed to resolve live free-model catalog — using env-configured models only.');
      return { general: [], vision: [] };
    } finally {
      clearTimeout(timer);
    }
  }

  private parseToolCalls(raw: unknown): ToolCall[] {
    if (!Array.isArray(raw)) return [];
    const calls: ToolCall[] = [];
    for (const tc of raw) {
      if (tc && typeof tc === 'object') {
        const id = (tc as { id?: string }).id ?? `call_${calls.length}`;
        const fn = (tc as { function?: { name?: string; arguments?: string } }).function;
        if (fn?.name) {
          calls.push({ id, name: fn.name, arguments: fn.arguments ?? '{}' });
        }
      }
    }
    return calls;
  }

  private isTransient(message: string): boolean {
    return /temporarily overloaded|overloaded|rate.?limit|429|too many|unavailable|upstream/i.test(message);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}