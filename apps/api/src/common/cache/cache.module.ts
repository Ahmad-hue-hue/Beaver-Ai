import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service.js';
import { RedisProvider, REDIS_CLIENT } from './redis.provider.js';

@Global()
@Module({
  providers: [RedisProvider, CacheService],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
