import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PlatformAdminGuard } from '../../common/auth/platform-admin.guard.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { AdminService } from './admin.service.js';

@ApiTags('admin')
@UseGuards(PlatformAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  /** Platform-wide headline numbers (businesses, users, subscription health, today's sales). */
  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  /** Every business with owner + subscription state + product/sales stats. */
  @Get('businesses')
  businesses(@Query() query: { search?: string; limit?: string; cursor?: string }) {
    return this.admin.listBusinesses(query);
  }

  /** Every platform user with subscription state. */
  @Get('users')
  users(@Query() query: { search?: string; limit?: string; cursor?: string }) {
    return this.admin.listUsers(query);
  }

  /** Accounts needing admin attention: pending approval or an expired month. */
  @Get('reviews')
  reviews(@Query() query: { search?: string; limit?: string; cursor?: string }) {
    return this.admin.listReviews(query);
  }

  /** Approve a pending account and grant its first paid month (30 days). */
  @Post('reviews/:userId/activate')
  activate(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.admin.activateUser(admin.userId, userId, this.meta(req));
  }

  /** Renew an account for another 30 days from today (or its current expiry, whichever is later). */
  @Post('reviews/:userId/renew')
  renew(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.admin.renewUser(admin.userId, userId, this.meta(req));
  }

  /** System-wide audit trail across all businesses. */
  @Get('activities')
  activities(@Query() query: { businessId?: string; action?: string; entityType?: string; limit?: string; cursor?: string }) {
    return this.admin.listActivities(query);
  }
}