import { Injectable, Logger } from '@nestjs/common';
import type { AiProvider, ChatMessage, CompleteOptions } from './ai.provider.js';

interface GooglePart {
  text?: string;
}

interface GoogleCandidate {
  content?: { parts?: GooglePart[] };
}

interface GoogleGenerateResponse {
  candidates?: GoogleCandidate[];
  error?: { message?: string };
}

/**
 * Live Google Gemini client over fetch. Dependency-free and thin, mirroring the Anthropic
 * provider: posts to the generateContent endpoint, streams nothing, returns the first text
 * part. Only constructed when a real Google API key is present.
 */
@Injectable()
export class GoogleAiProvider implements AiProvider {
  readonly name = 'google';
  readonly isLive = true;

  private readonly logger = new Logger(GoogleAiProvider.name);
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly maxTokens: number,
  ) {}

  async complete(opts: CompleteOptions): Promise<string> {
    const maxTokens = opts.maxOutputTokens ?? this.maxTokens;
    const { system, contents } = buildContents(opts.messages);
    const payload: Record<string, unknown> = { contents, generationConfig: { temperature: opts.temperature ?? 0.4, maxOutputTokens: maxTokens } };
    if (system) payload.systemInstruction = { parts: [{ text: system }] };

    try {
      const res = await fetch(`${this.baseUrl}/models/${this.model}:generateContent`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
        throw new Error(`AI provider returned HTTP ${res.status}`);
      }

      const data = (await res.json()) as GoogleGenerateResponse;
      if (!data.candidates?.length || data.error) {
        throw new Error(data.error?.message ?? 'AI provider returned no candidates.');
      }
      const text = (data.candidates[0]?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('\n')
        .trim();
      if (!text) throw new Error('AI provider returned no text.');
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI completion failed: ${message}`);
      throw err;
    }
  }
}

/**
 * Gemini separates the system instruction from the turn list and requires alternating
 * `user`/`model` roles (consecutive identical roles must merge into one content block).
 */
function buildContents(msgs: ChatMessage[]): { system?: string; contents: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> } {
  let system: string | undefined;
  const contents: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = [];

  for (const m of msgs) {
    const text = m.content.trim();
    if (!text) continue;
    if (m.role === 'system') {
      system = system ? `${system}\n\n${text}` : text;
      continue;
    }
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text });
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  while (contents[0]?.role === 'model') contents.shift();
  return { system, contents };
}