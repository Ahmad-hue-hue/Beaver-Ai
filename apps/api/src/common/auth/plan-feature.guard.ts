import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { canUseFeature, type FeatureKey } from '@beaver/shared';
import type { AuthenticatedUser } from './auth.types.js';
import { PLAN_FEATURE_KEY } from './decorators.js';

const UPGRADE_MESSAGES: Record<FeatureKey, string> = {
  ai: 'The AI assistant is part of the Basic plan and up.',
  financialReports: 'Financial reports are part of the Pro plan and up.',
  paidPaymentMethods: 'Digital payments are part of the Basic plan and up.',
  branches: 'Multiple branches are part of the Business plan.',
};

/**
 * Enforces @RequirePlanFeature(...): the active business (or an active trial) must be able to
 * use the premium feature. Runs after JwtAuthGuard, so req.user carries plan + isTrial from the
 * signed JWT — no DB hit. Trial bypasses the gate (customer-friendly).
 */
@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const feature = this.reflector.getAllAndOverride<FeatureKey>(PLAN_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user?.businessId) {
      throw new ForbiddenException('No active business.');
    }

    if (!canUseFeature(user.plan, user.isTrial, feature)) {
      throw new ForbiddenException(UPGRADE_MESSAGES[feature]);
    }
    return true;
  }
}
