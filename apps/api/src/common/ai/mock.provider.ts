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

/** User messages that ask the agent to change data — mock mode cannot execute tools. */
const ACTION_REQUEST =
  /\b(add|create|record|register|order|sell|sale|customer|product|expense|stock|purchase|void|pay|adjust|receive|supplier|category)\b/i;

function normalize(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) {
    return "I'm your shop assistant. Share a question you need help with and I'll dig into your business data for you.";
  }
  if (ACTION_REQUEST.test(t)) {
    return (
      `I can't take that action right now — Beaver is running in offline mode (no AI API key configured), ` +
      `so I cannot create customers, record sales, or change your shop data.\n\n` +
      `To enable live actions, set OPENROUTER_API_KEY in your server .env and restart the API. ` +
      `Until then, use POS, Customers, and the other screens directly, or ask me questions about your existing data.`
    );
  }
  return (
    `I'm running in offline mode (no live AI model), so I can answer questions about your shop data ` +
    `but I cannot create customers, record sales, or change anything in the system.\n\n` +
    `Set OPENROUTER_API_KEY in your server .env to enable live agent actions.`
  );
}

