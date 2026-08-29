import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS, type PlanKey } from '@beaver/shared';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { BusinessId, CurrentUser, Public, RequirePermissions } from '../../common/auth/decorators.js';
import type { RequestMeta, SessionResult } from '../auth/auth.service.js';
import { BillingService } from './billing.service.js';
import { ChangePlanDto, StartTrialDto } from './dto.js';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  /** Public plan catalog powering the marketing pricing page. */
  @Public()
  @Get('plans')
  getPlans() {
    return this.billing.getPlans();
  }

  /** Public premium-feature list for the pricing page. */
  @Public()
  @Get('features')
  getFeatures() {
    return this.billing.getFeatures();
  }

  /** Current plan, trial, and usage for the active business. */
  @Get('current')
  getCurrent(@BusinessId() businessId: string) {
    return this.billing.getCurrent(businessId);
  }

  /** Manually change the active business's plan (no payment provider yet). Re-issues session. */
  @Patch('plan')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  changePlan(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePlanDto,
    @Req() req: Request,
  ): Promise<SessionResult> {
    return this.billing.changePlan(user.userId, businessId, dto.plan as PlanKey, this.meta(req));
  }

  /** Start the 14-day all-features trial. Idempotent when one is active. */
  @Post('trial')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  startTrial(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartTrialDto,
    @Req() req: Request,
  ): Promise<SessionResult> {
    return this.billing.startTrial(user.userId, businessId, dto.endsAt, this.meta(req));
  }
}
