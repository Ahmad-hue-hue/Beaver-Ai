import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { AppConfig } from '../../config/configuration.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { normalizePhone } from '../../common/phone.js';

/**
 * Ensures a first platform admin exists. On boot, when the users table holds
 * no platform admin, one is created from ADMIN_PHONE / ADMIN_PASSWORD /
 * ADMIN_NAME (pre-approved, never expires). Runs once — existing admins are
 * never touched, and without the env pair it only logs guidance.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.bootstrap = config.get<AppConfig['adminBootstrap']>('adminBootstrap')!;
  }

  private readonly bootstrap: AppConfig['adminBootstrap'];

  async onModuleInit() {
    const adminCount = await this.prisma.user.count({
      where: { isPlatformAdmin: true, deletedAt: null },
    });
    if (adminCount > 0) return;

    const { phone, password, name } = this.bootstrap;
    if (!phone || !password) {
      this.logger.warn(
        'No platform admin exists. Set ADMIN_PHONE and ADMIN_PASSWORD in the environment to auto-create one.',
      );
      return;
    }

    let normalized: string;
    try {
      normalized = normalizePhone(phone);
    } catch {
      this.logger.error('ADMIN_PHONE is not a valid Tanzanian phone number — admin not created.');
      return;
    }
    if (password.length < 8) {
      this.logger.error('ADMIN_PASSWORD must be at least 8 characters — admin not created.');
      return;
    }

    const existing = await this.prisma.user.findUnique({ where: { phone: normalized } });
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { isPlatformAdmin: true, approvedAt: existing.approvedAt ?? new Date() },
      });
      this.logger.log(`Existing account ${normalized} promoted to platform admin.`);
      return;
    }

    await this.prisma.user.create({
      data: {
        name,
        phone: normalized,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        isPlatformAdmin: true,
        approvedAt: new Date(),
      },
    });
    this.logger.log(`Platform admin ${normalized} created from environment.`);
  }
}
