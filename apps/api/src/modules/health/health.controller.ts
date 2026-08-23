import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/cache/redis.provider.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Public } from '../../common/auth/decorators.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async check() {
    const [db, redis] = await Promise.all([this.pingDb(), this.pingRedis()]);
    const ok = db && redis;
    return {
      status: ok ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      services: { database: db ? 'up' : 'down', redis: redis ? 'up' : 'down' },
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
