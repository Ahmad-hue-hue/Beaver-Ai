import { randomBytes, createHash } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { isTrialActive, type PlanKey, type Role } from '@beaver/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TokenService, type IssuedTokens } from './token.service.js';
import type { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto.js';

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

export interface SessionResult extends IssuedTokens {
  user: { id: string; name: string; email: string; isPlatformAdmin: boolean };
  businessId: string | null;
  role: Role | null;
  plan: PlanKey | null;
  isTrial: boolean;
  memberships: { businessId: string; businessName: string; role: Role; plan: PlanKey; isTrial: boolean }[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async register(dto: RegisterDto, meta: RequestMeta): Promise<SessionResult> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists.');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { name: dto.name.trim(), email, phone: dto.phone ?? null, passwordHash },
    });

    // No business yet — onboarding creates the first one and re-issues a scoped session.
    return this.buildSession(user, null, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<SessionResult> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { where: { status: 'ACTIVE' }, include: { business: true } } },
    });
    // Constant-ish work whether or not the user exists (avoid user enumeration via timing).
    const hash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$aaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const valid = await argon2.verify(hash, dto.password).catch(() => false);
    if (!user || !valid || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Pick the most recently updated active business as the default active context.
    const active = [...user.memberships].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0];

    return this.buildSession(user, active?.businessId ?? null, meta);
  }

  /** Build a session scoped to a business (or none), computing role + permissions. */
  async buildSession(
    user: { id: string; name: string; email: string; isPlatformAdmin: boolean },
    businessId: string | null,
    meta: RequestMeta,
  ): Promise<SessionResult> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { business: true },
    });

    const active = businessId
      ? memberships.find((m) => m.businessId === businessId)
      : undefined;

    const activePlan = (active?.business.plan as PlanKey) ?? null;
    const activeTrial = isTrialActive(active?.business.trialEndsAt);

    const issued = await this.tokens.issueSession(
      {
        userId: user.id,
        businessId: active?.businessId ?? null,
        role: (active?.role as Role) ?? null,
        extraPermissions: active?.extraPermissions ?? [],
        isPlatformAdmin: user.isPlatformAdmin,
        plan: activePlan,
        isTrial: activeTrial,
      },
      meta,
    );

    return {
      ...issued,
      user: { id: user.id, name: user.name, email: user.email, isPlatformAdmin: user.isPlatformAdmin },
      businessId: active?.businessId ?? null,
      role: (active?.role as Role) ?? null,
      plan: activePlan,
      isTrial: activeTrial,
      memberships: memberships.map((m) => ({
        businessId: m.businessId,
        businessName: m.business.name,
        role: m.role as Role,
        plan: (m.business.plan as PlanKey) ?? 'FREE',
        isTrial: isTrialActive(m.business.trialEndsAt),
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
    if (currentRefresh) await this.tokens.revokeRefreshToken(currentRefresh);
    return this.buildSession(user, businessId, meta);
  }

  /**
   * Begin password reset. Always returns the same response (no user enumeration). Returns the
   * raw token only in non-production so dev/tests can complete the flow without email.
   */
  async requestPasswordReset(dto: ForgotPasswordDto): Promise<{ devToken?: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return {};

    const raw = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: AuthService.hashToken(raw),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });
    // TODO(M7): deliver via email/SMS. For now surfaced only in non-prod.
    this.logger.log(`Password reset requested for ${email}`);
    return process.env.NODE_ENV === 'production' ? {} : { devToken: raw };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: AuthService.hashToken(dto.token) },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired reset link.');
    }
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Invalidate all existing sessions on password change.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
