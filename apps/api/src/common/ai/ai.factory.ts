import { type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';
import { AI_PROVIDER } from './ai.constants.js';
import type { AiProvider } from './ai.provider.js';
import { AnthropicAiProvider } from './anthropic.provider.js';
import { GoogleAiProvider } from './google.provider.js';
import { MockAiProvider } from './mock.provider.js';

/**
 * Selects the AI provider from config: a live provider (Google Gemini, else Anthropic) when
 * the matching key is present, otherwise the deterministic mock so the app keeps running
 * untested no-key and test suites stay green.
 */
export const AiProviderFactory: Provider = {
  provide: AI_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): AiProvider => {
    const ai = config.get<AppConfig['ai']>('ai')!;
    if (ai.provider === 'google' && ai.apiKey) {
      return new GoogleAiProvider(ai.apiKey, ai.model, ai.maxOutputTokens);
    }
    if (ai.provider === 'anthropic' && ai.apiKey) {
      return new AnthropicAiProvider(ai.apiKey, ai.model, ai.maxOutputTokens);
    }
    return new MockAiProvider();
  },
};
