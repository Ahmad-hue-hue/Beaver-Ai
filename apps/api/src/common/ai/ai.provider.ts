/**
 * AI provider abstraction. Modules depend on this interface (never on a specific vendor)
 * so the app runs with the mock provider when no API key is configured and can swap to a
 * live provider (Anthropic) via config without touching callers.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  messages: ChatMessage[];
  maxOutputTokens?: number;
  temperature?: number;
}

export interface AiProvider {
  readonly name: string;
  /** Whether this provider talks to a real external model. */
  readonly isLive: boolean;
  complete(opts: CompleteOptions): Promise<string>;
}
