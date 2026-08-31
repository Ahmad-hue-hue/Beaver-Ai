import type { AiProvider, ChatMessage, CompleteOptions, CompleteResult } from './ai.provider.js';

/**
 * Deterministic fallback that never needs a key. Returns a safe, stable answer so the app
 * and its tests run end-to-end with no external dependency. Real narratives come from the
 * rule-based insight agents (see modules/ai/agents.service) which are surfaced regardless.
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  readonly isLive = false;

  async complete(_opts: CompleteOptions): Promise<CompleteResult> {
    const lastUser = [..._opts.messages].reverse().find((m: ChatMessage) => m.role === 'user');
    return { text: normalize(lastUser?.content ?? ''), toolCalls: [] };
  }
}

function normalize(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) {
    return "I'm your shop assistant. Share a question you need help with and I'll dig into your business data for you.";
  }
  return `I see you're asking: \u201c${truncate(t, 180)}\u201d.
I'm running in study mode right now, so I'm answering with the deterministic insights below \u2014 drawn
from your real sales, stock, cash and debt data \u2014 rather than a live model. They flag what needs
attention so you can act.`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}\u2026`;
}
