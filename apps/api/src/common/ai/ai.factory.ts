import { type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';
import { AI_PROVIDER } from './ai.constants.js';
import type { AiProvider } from './ai.provider.js';
import { AnthropicAiProvider } from './anthropic.provider.js';
import { MockAiProvider } from './mock.provider.js';

/**
 * Selects the AI provider from config: live Anthropic when a key is present, otherwise the
 * deterministic mock so the app keeps running untested no-key and test suites stay green.
 */
export const AiProviderFactory: Provider = {
  provide: AI_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): AiProvider => {
    const ai = config.get<AppConfig['ai']>('ai')!;
    if (ai.provider === 'anthropic' && ai.apiKey) {
      return new AnthropicAiProvider(ai.apiKey, ai.model, ai.maxOutputTokens);
    }
    return new MockAiProvider();
  },
};
