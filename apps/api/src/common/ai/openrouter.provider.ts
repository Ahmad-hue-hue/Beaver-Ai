import { Injectable, Logger } from '@nestjs/common';
import type { AiProvider, CompleteOptions } from './ai.provider.js';

/**
 * OpenRouter AI provider — OpenAI-compatible endpoint at
 * https://openrouter.ai/api/v1/chat/completions with Bearer auth.
 *
 * Model IDs follow the `provider/model-name` format, e.g.
 *   nvidia/nemotron-3-super-120b-a12b:free
 *   openai/gpt-4o-mini
 *   anthropic/claude-3-opus-20240229
 */
@Injectable()
export class OpenRouterAiProvider implements AiProvider {
  readonly name = 'openrouter';
  readonly isLive = true;

  private readonly logger = new Logger(OpenRouterAiProvider.name);
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly maxTokens: number,
    private readonly visionModel?: string,
  ) {}

  async complete(opts: CompleteOptions): Promise<string> {
    const maxTokens = opts.maxOutputTokens ?? this.maxTokens;
    const imagesPresent = opts.messages.some((m) => m.images && m.images.length > 0);
    const model = imagesPresent && this.visionModel ? this.visionModel : this.model;
    const messages: Array<{ role: string; content: string | unknown }> = [];

    for (const m of opts.messages) {
      const role: 'system' | 'user' | 'assistant' =
        m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user';

      const content: string | unknown = m.images && m.images.length > 0
        ? [
            { type: 'text', text: m.content.trim() },
            ...m.images.map((src) => ({ type: 'image_url', image_url: { url: src } })),
          ]
        : m.content.trim();

      messages.push({ role, content });
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature: opts.temperature ?? 0.7,
    };

    // Free-tier providers transiently overload; retry a few times with backoff.
    const attempts = 3;
    for (let attempt = 1; attempt <= attempts; attempt++) {
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
          this.logger.error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
          if (attempt < attempts && (res.status === 429 || res.status >= 500)) {
            await this.sleep(attempt * 1500);
            continue;
          }
          throw new Error(`AI provider returned HTTP ${res.status}`);
        }

        const data = (await res.json()) as {
          choices?: { index: number; message: { role: string; content?: string }; finish_reason?: string }[];
          error?: { message?: string };
        };

        if (!data.choices?.length || data.error) {
          const upstreamMessage = data.error?.message ?? 'AI provider returned no choices.';
          if (attempt < attempts && this.isTransient(upstreamMessage)) {
            this.logger.warn(`Transient upstream error, retrying: ${upstreamMessage}`);
            await this.sleep(attempt * 1500);
            continue;
          }
          throw new Error(upstreamMessage);
        }

        const text = data.choices[0]?.message?.content?.trim();
        if (!text) throw new Error('AI provider returned no text.');
        return text;
      } catch (err) {
        if (attempt === attempts || !this.isTransient(String(err instanceof Error ? err.message : err))) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`AI completion failed: ${message}`);
          throw err;
        }
        this.logger.warn(`Transient error, retrying: ${String(err)}`);
        await this.sleep(attempt * 1500);
      }
    }
    throw new Error('AI provider failed after retries.');
  }

  private isTransient(message: string): boolean {
    return /temporarily overloaded|overloaded|rate.?limit|429|too many|unavailable|upstream/i.test(message);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}