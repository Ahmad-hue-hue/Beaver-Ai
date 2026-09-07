import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Role } from '@beaver/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { normalizePhone } from '../../common/phone.js';
import { TokenService, type IssuedTokens } from './token.service.js';
import type { ChangePasswordDto, LoginDto, RegisterDto } from './dto.js';

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

export type ServiceStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED';

export interface SessionResult extends IssuedTokens {
  user: { id: string; name: string; phone: string; isPlatformAdmin: boolean };
  businessId: string | null;
  role: Role | null;
  serviceStatus: ServiceStatus;
  serviceExpiresAt: string | null;
  memberships: { businessId: string; businessName: string; role: Role }[];
}

export interface RegisterResult {
  id: string;
  status: 'PENDING';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  private static serviceStatus(user: {
    approvedAt: Date | null;
    serviceExpiresAt: Date | null;
  }): ServiceStatus {
    if (!user.approvedAt) return 'PENDING';
    if (!user.serviceExpiresAt || user.serviceExpiresAt.getTime() > Date.now()) return 'ACTIVE';
    return 'EXPIRED';
  }

  /**
   * Blocks session issuance for accounts that are pending approval or whose paid month has
   * lapsed. Called at every token-issuing boundary (login, refresh, switch-business).
   */
  private static assertServiceActive(user: {
    approvedAt: Date | null;
    serviceExpiresAt: Date | null;
  }): void {
    const status = AuthService.serviceStatus(user);
    if (status === 'PENDING') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_PENDING',
        message: 'Your account is awaiting admin approval.',
      });
    }
    if (status === 'EXPIRED') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_EXPIRED',
        message: 'Your subscription has expired. Contact the admin to renew it.',
      });
    }
  }

  /** Creates a pending account. No session is issued until the admin approves it. */
  async register(dto: RegisterDto, _meta: RequestMeta): Promise<RegisterResult> {
    const phone = normalizePhone(dto.phone);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) throw new ConflictException('An account with this phone number already exists.');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { name: dto.name.trim(), phone, passwordHash },
    });
    return { id: user.id, status: 'PENDING' };
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<SessionResult> {
    let phone: string;
    try {
      phone = normalizePhone(dto.phone);
    } catch {
      // Fall through to the generic failure below (no identity probing via errors).
      phone = '';
    }
    const user = phone
      ? await this.prisma.user.findUnique({
        where: { phone },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { business: { select: { id: true, name: true } } },
          },
        },
      })
      : null;
    // Constant-ish work whether or not the user exists (avoid user enumeration via timing).
    const hash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$aaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const valid = await argon2.verify(hash, dto.password).catch(() => false);
    if (!user || !valid || user.deletedAt) {
      throw new UnauthorizedException('Invalid phone number or password.');
    }

    // A valid password is required before revealing the account's approval state.
    AuthService.assertServiceActive(user);

    // Pick the most recently updated active business as the default active context.
    const active = [...user.memberships].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0];

    return this.buildSession(user, active?.businessId ?? null, meta);
  }

  /** Build a session scoped to a business (or none), computing role + permissions. */
  async buildSession(
    user: { id: string; name: string; phone: string; isPlatformAdmin: boolean },
    businessId: string | null,
    meta: RequestMeta,
  ): Promise<SessionResult> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { business: { select: { id: true, name: true } } },
    });

    const active = businessId
      ? memberships.find((m) => m.businessId === businessId)
      : undefined;

    const me = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { approvedAt: true, serviceExpiresAt: true },
    });

    const issued = await this.tokens.issueSession(
      {
        userId: user.id,
        businessId: active?.businessId ?? null,
        role: (active?.role as Role) ?? null,
        extraPermissions: active?.extraPermissions ?? [],
        isPlatformAdmin: user.isPlatformAdmin,
      },
      meta,
    );

    return {
      ...issued,
      user: { id: user.id, name: user.name, phone: user.phone, isPlatformAdmin: user.isPlatformAdmin },
      businessId: active?.businessId ?? null,
      role: (active?.role as Role) ?? null,
      serviceStatus: AuthService.serviceStatus(
        me ?? { approvedAt: null, serviceExpiresAt: null },
      ),
      serviceExpiresAt: me?.serviceExpiresAt?.toISOString() ?? null,
      memberships: memberships.map((m) => ({
        businessId: m.businessId,
        businessName: m.business.name,
        role: m.role as Role,
      })),
    };
  }

  /** Rotate a refresh token: validate, revoke old, issue a new session for the same context. */
  async refresh(opaque: string | undefined, meta: RequestMeta): Promise<SessionResult> {
    if (!opaque) throw new UnauthorizedException('Missing refresh token.');
    const record = await this.tokens.findValidRefreshToken(opaque);
    if (!record) throw new UnauthorizedException('Session expired. Please sign in again.');

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException('Account is no longer active.');
    AuthService.assertServiceActive(user);

    await this.tokens.revokeRefreshToken(opaque); // rotation
    return this.buildSession(user, record.businessId, meta);
  }

  async logout(opaque: string | undefined): Promise<void> {
    if (opaque) await this.tokens.revokeRefreshToken(opaque);
  }

  /**
   * Switch the active business. Verifies membership, revokes the current refresh token, and
   * issues a new session scoped to the target business.
   */
  async switchBusiness(userId: string, businessId: string, currentRefresh: string | undefined, meta: RequestMeta): Promise<SessionResult> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_businessId: { userId, businessId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('You are not a member of that business.');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    AuthService.assertServiceActive(user);
    if (currentRefresh) await this.tokens.revokeRefreshToken(currentRefresh);
    return this.buildSession(user, businessId, meta);
  }

  /**
   * Change the caller's own password. Verifies the current password first and
   * invalidates every other session — the path users take after receiving an
   * admin-issued temporary password.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentRefresh: string | undefined,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException('Account is no longer active.');
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword).catch(() => false);
    if (!valid) throw new UnauthorizedException('Current password is incorrect.');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current one.');
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    const currentHash = currentRefresh ? TokenService.hashOpaque(currentRefresh) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      // Invalidate all sessions except the one making this call.
      await tx.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
        },
        data: { revokedAt: new Date() },
      });
    });
  }
}