import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.provider.js';

/**
 * Cache-aside helper over Redis. Keys are namespaced `biz:{businessId}:{metric}:{variant}`
 * so a business's cached analytics can be invalidated wholesale on a relevant domain event.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  static key(businessId: string, metric: string, variant = 'default'): string {
    return `biz:${businessId}:${metric}:${variant}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /** Cache-aside: return cached value or compute, store, and return it. */
  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /** Invalidate all cached entries for a business (optionally a single metric). */
  async invalidateBusiness(businessId: string, metric?: string): Promise<void> {
    const pattern = metric ? `biz:${businessId}:${metric}:*` : `biz:${businessId}:*`;
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length) {
        await this.redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    if (deleted) this.logger.debug(`Invalidated ${deleted} cache keys for ${pattern}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
