import { Global, Module } from '@nestjs/common';
import { CacheInvalidationListener } from './cache-invalidation.listener.js';

/**
 * Wires cross-cutting event listeners. The EventEmitterModule itself is configured globally
 * in AppModule; this module registers Beaver's listeners.
 */
@Global()
@Module({
  providers: [CacheInvalidationListener],
})
export class EventsModule {}
