/**
 * AI provider abstraction. Modules depend on this interface (never on a specific vendor)
 * so the app runs with the mock provider when no API key is configured and can swap to a
 * live provider (OpenRouter) via config without touching callers.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Optional base64 image data URLs (e.g. data:image/png;base64,…) to attach to this message. */
  images?: string[];
  /** Tool-call id this message answers (only relevant for role 'tool'). */
  name?: string;
  /** Preceding tool calls made by an assistant turn, for round-trip persistence. */
  toolCalls?: ToolCall[];
}

/** An OpenAI-compatible JSON tool/function definition sent to the model. */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** A single tool invocation the model requested. */
export interface ToolCall {
  id: string;
  name: string;
  /** Raw JSON string of the arguments (parsed by the caller). */
  arguments: string;
}

export interface CompleteOptions {
  messages: ChatMessage[];
  /** Optional JSON tool/function definitions to expose to the model. */
  tools?: ToolDefinition[];
  maxOutputTokens?: number;
  temperature?: number;
}

export interface CompleteResult {
  /** The final assistant text, if any. */
  text: string;
  /** Tool calls the model wants executed next, if any. */
  toolCalls: ToolCall[];
}

export interface AiProvider {
  readonly name: string;
  /** Whether this provider talks to a real external model. */
  readonly isLive: boolean;
  complete(opts: CompleteOptions): Promise<CompleteResult>;
}
