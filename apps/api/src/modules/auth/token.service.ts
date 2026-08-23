import { randomBytes, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  permissionsForRole,
  type Permission,
  type Role,
} from '@beaver/shared';
import type { AppConfig } from '../../config/configuration.js';
import type { JwtPayload } from '../../common/auth/auth.types.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface SessionContext {
  userId: string;
  businessId: string | null;
  role: Role | null;
  extraPermissions?: string[];
  isPlatformAdmin: boolean;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string; // opaque; set as httpOnly cookie
  expiresIn: number; // access token TTL (seconds)
}

@Injectable()
export class TokenService {
  private readonly jwtCfg: AppConfig['jwt'];

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.jwtCfg = config.get<AppConfig['jwt']>('jwt')!;
  }

  /** Effective permissions for a session = role defaults ∪ any extra grants on the membership. */
  static resolvePermissions(role: Role | null, extra: string[] = []): Permission[] {
    const base = role ? permissionsForRole(role) : [];
    return Array.from(new Set<Permission>([...base, ...(extra as Permission[])]));
  }

  signAccessToken(ctx: SessionContext): string {
    const payload: JwtPayload = {
      sub: ctx.userId,
      bid: ctx.businessId,
      role: ctx.role,
      perms: TokenService.resolvePermissions(ctx.role, ctx.extraPermissions),
      adm: ctx.isPlatformAdmin,
    };
    return this.jwt.sign(payload, {
      secret: this.jwtCfg.accessSecret,
      expiresIn: this.jwtCfg.accessTtl,
    });
  }

  private static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Create a persisted, hashed refresh token and return the opaque value for the cookie. */
  async issueRefreshToken(
    userId: string,
    businessId: string | null,
    meta: { userAgent?: string; ip?: string } = {},
  ): Promise<string> {
    const opaque = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + this.jwtCfg.refreshTtl * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        businessId,
        tokenHash: TokenService.hash(opaque),
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
        expiresAt,
      },
    });
    return opaque;
  }

  /** Issue access + refresh tokens for a session context. */
  async issueSession(ctx: SessionContext, meta: { userAgent?: string; ip?: string }): Promise<IssuedTokens> {
    const accessToken = this.signAccessToken(ctx);
    const refreshToken = await this.issueRefreshToken(ctx.userId, ctx.businessId, meta);
    return { accessToken, refreshToken, expiresIn: this.jwtCfg.accessTtl };
  }

  /** Validate an opaque refresh token; returns the stored row or null if invalid/expired/revoked. */
  async findValidRefreshToken(opaque: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: TokenService.hash(opaque) },
    });
    if (!record) return null;
    if (record.revokedAt || record.expiresAt.getTime() < Date.now()) return null;
    return record;
  }

  async revokeRefreshToken(opaque: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: TokenService.hash(opaque), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  get refreshTtlSeconds(): number {
    return this.jwtCfg.refreshTtl;
  }
}
