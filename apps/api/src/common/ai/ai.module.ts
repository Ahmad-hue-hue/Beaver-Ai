import { Global, Module } from '@nestjs/common';
import { AiProviderFactory } from './ai.factory.js';
import { AI_PROVIDER } from './ai.constants.js';

/** Global module exposing the configured AI provider for any consuming service. */
@Global()
@Module({
  providers: [AiProviderFactory],
  exports: [AI_PROVIDER],
})
export class AiModule {}
