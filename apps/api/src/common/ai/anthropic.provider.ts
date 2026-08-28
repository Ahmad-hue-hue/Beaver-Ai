import { Injectable, Logger } from '@nestjs/common';
import type { AiProvider, ChatMessage, CompleteOptions } from './ai.provider.js';

interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

/**
 * Live Anthropic client over fetch. Kept dependency-free (no SDK) and thin: constructs the
 * Messages payload, streams nothing, returns the first text block. Only constructed when a
 * real API key is present.
 */
@Injectable()
export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic';
  readonly isLive = true;

  private readonly logger = new Logger(AnthropicAiProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly maxTokens: number,
  ) {}

  async complete(opts: CompleteOptions): Promise<string> {
    const maxTokens = opts.maxOutputTokens ?? this.maxTokens;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          temperature: opts.temperature ?? 0.4,
          messages: modelMessages(opts.messages),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
        throw new Error(`AI provider returned HTTP ${res.status}`);
      }

      const data = (await res.json()) as { content: AnthropicContentBlock[] };
      const text = (data.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
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

/** Anthropic uses a system message separate from the user/assistant turn list. */
function modelMessages(msgs: ChatMessage[]): Array<{ role: string; content: string }> {
  return msgs
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
}
