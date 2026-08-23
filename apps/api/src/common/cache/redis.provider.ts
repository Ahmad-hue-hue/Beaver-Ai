import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfig } from '../../config/configuration.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** Shared ioredis connection (used by CacheService; BullMQ uses its own from the same config). */
export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const redis = config.get<AppConfig['redis']>('redis')!;
    const logger = new Logger('Redis');
    const client = new Redis({
      host: redis.host,
      port: redis.port,
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    client.on('connect', () => logger.log(`Connected to Redis at ${redis.host}:${redis.port}`));
    client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
    return client;
  },
};
