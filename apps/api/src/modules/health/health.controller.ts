import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/cache/redis.provider.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Public } from '../../common/auth/decorators.js';

/**
 * Health splits liveness from readiness:
 *  - /api/v1/health/live — process is up (always 200). For orchestrators deciding restart.
 *  - /api/v1/health/ready — dependencies reachable (DB + Redis). 503 when not.
 *  - /api/v1/health — alias for liveness (kept for backwards compatibility).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  live() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('live')
  liveRoute() {
    return this.live();
  }

  @Public()
  @Get('ready')
  @HttpCode(200)
  async ready() {
    const [db, redis] = await Promise.all([this.pingDb(), this.pingRedis()]);
    const ok = db && redis;
    if (!ok) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        uptime: Math.round(process.uptime()),
        services: { database: db ? 'up' : 'down', redis: redis ? 'up' : 'down' },
        timestamp: new Date().toISOString(),
      });
    }
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      services: { database: 'up', redis: 'up' },
      timestamp: new Date().toISOString(),
    };
  }

  private async pingDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}