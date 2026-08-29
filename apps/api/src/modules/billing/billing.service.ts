import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FEATURE_LISTINGS, FeatureKey, PLANS, canUseFeature, isPaidPaymentMethodBlocked, isTrialActive, productLimitFor, type PlanKey } from '@beaver/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { AuthService, type RequestMeta, type SessionResult } from '../auth/auth.service.js';

export const TRIAL_DAYS = 14;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  // ─────────────────────────── Public catalog ───────────────────────────

  getPlans() {
    return PLANS;
  }

  /** The premium feature catalog (key + label), for the pricing page feature lists. */
  getFeatures() {
    return FEATURE_LISTINGS.map((f) => ({ key: f.key, label: f.label }));
  }

  // ─────────────────────────── Reads ───────────────────────────

  async getCurrent(businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
    });
    if (!business) throw new NotFoundException('Business not found.');

    const plan = (business.plan as PlanKey) ?? 'FREE';
    const isTrial = isTrialActive(business.trialEndsAt);
    const productLimit = productLimitFor(plan);
    const activeProducts = await this.prisma.product.count({
      where: { businessId, deletedAt: null, isArchived: false },
    });

    return {
      plan,
      trialEndsAt: business.trialEndsAt,
      isTrial,
      trialDays: isTrial && business.trialEndsAt
        ? Math.max(0, Math.ceil((business.trialEndsAt.getTime() - Date.now()) / 86_400_000))
        : 0,
      limits: {
        products: productLimit,
      },
      usage: {
        products: activeProducts,
      },
    };
  }

  // ─────────────────────────── Mutations ───────────────────────────

  /**
   * Manually set the business plan (no payment provider yet — owner/admin override).
   * Re-issues the session so the new plan propagates to the client + JWT.
   */
  async changePlan(
    userId: string,
    businessId: string,
    plan: PlanKey,
    meta: RequestMeta,
  ): Promise<SessionResult> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
    });
    if (!business) throw new NotFoundException('Business not found.');
    if (business.plan === plan) throw new BadRequestException(`Business is already on the ${plan} plan.`);

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { plan, planChangedAt: new Date(), planChangedBy: userId },
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'billing.plan_change',
      entityType: 'Business',
      entityId: businessId,
      before: { plan: business.plan },
      after: { plan: updated.plan },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.auth.buildSession(user, businessId, meta);
  }

  /** Start the 14-day all-features trial (idempotent). Re-issues the session. */
  async startTrial(
    userId: string,
    businessId: string,
    endsAt: string | undefined,
    meta: RequestMeta,
  ): Promise<SessionResult> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
    });
    if (!business) throw new NotFoundException('Business not found.');
    if (isTrialActive(business.trialEndsAt)) {
      throw new BadRequestException('A trial is already active for this business.');
    }

    const end = endsAt ? new Date(endsAt) : new Date(Date.now() + TRIAL_DAYS * 86_400_000);
    await this.prisma.business.update({
      where: { id: businessId },
      data: { trialEndsAt: end, planChangedAt: new Date(), planChangedBy: userId },
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'billing.trial_start',
      entityType: 'Business',
      entityId: businessId,
      after: { trialEndsAt: end.toISOString() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.auth.buildSession(user, businessId, meta);
  }

  // ─────────────────────────── Enforcement helpers ───────────────────────────

  /** Load plan + trial state for a business. */
  private async planState(businessId: string): Promise<{ plan: PlanKey; isTrial: boolean }> {
    const business = await this.prisma.business.findFirst({ where: { id: businessId, deletedAt: null } });
    return {
      plan: (business?.plan as PlanKey) ?? 'FREE',
      isTrial: isTrialActive(business?.trialEndsAt),
    };
  }

  /** Throws unless the business (or an active trial) can use the given premium feature. */
  async gateFeature(businessId: string, feature: FeatureKey): Promise<void> {
    const { plan, isTrial } = await this.planState(businessId);
    if (!canUseFeature(plan, isTrial, feature)) {
      throw new ForbiddenException(this.upgradeMessage(feature));
    }
  }

  /** Throws if the business may not take mobile-money / card / bank tender. */
  async gatePaidPaymentMethod(businessId: string): Promise<void> {
    const { plan, isTrial } = await this.planState(businessId);
    if (isPaidPaymentMethodBlocked(plan, isTrial)) {
      throw new ForbiddenException(
        'Digital payments (mobile money, card, bank) are part of the Basic plan and up.',
      );
    }
  }

  /** Enforces the generous soft cap on active products. Throws only at absurd scale. */
  async assertProductQuota(businessId: string, adding: number = 1): Promise<void> {
    const { plan, isTrial } = await this.planState(businessId);
    if (isTrial) return;
    const limit = productLimitFor(plan);
    if (limit === null) return;

    const activeProducts = await this.prisma.product.count({
      where: { businessId, deletedAt: null, isArchived: false },
    });
    if (activeProducts + adding > limit) {
      throw new ForbiddenException(
        `You’ve reached the ${plan} plan’s limit of ${limit} products. Upgrade to add more.`,
      );
    }
  }

  private upgradeMessage(feature: FeatureKey): string {
    const map: Record<FeatureKey, string> = {
      ai: 'The AI assistant is part of the Basic plan and up.',
      financialReports: 'Financial reports are part of the Pro plan and up.',
      paidPaymentMethods: 'Digital payments are part of the Basic plan and up.',
      branches: 'Multiple branches are part of the Business plan.',
    };
    return map[feature];
  }
}
