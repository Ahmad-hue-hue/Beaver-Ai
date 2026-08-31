import { type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';
import { AI_PROVIDER } from './ai.constants.js';
import type { AiProvider } from './ai.provider.js';
import { OpenRouterAiProvider } from './openrouter.provider.js';
import { MockAiProvider } from './mock.provider.js';

/**
 * Selects the AI provider from config: OpenRouter when the API key is present,
 * otherwise the deterministic mock so the app keeps running untested with no key.
 */
export const AiProviderFactory: Provider = {
  provide: AI_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): AiProvider => {
    const ai = config.get<AppConfig['ai']>('ai')!;
    if (ai.provider === 'openrouter' && ai.apiKey) {
      return new OpenRouterAiProvider(ai.apiKey, ai.model, ai.maxOutputTokens, ai.visionModel);
    }
    return new MockAiProvider();
  },
};
