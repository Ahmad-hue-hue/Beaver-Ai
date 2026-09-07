import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PlatformAdminGuard } from '../../common/auth/platform-admin.guard.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { AdminService } from './admin.service.js';
import { ListPaymentsQuery, RecordPaymentDto, UpdateBusinessDto, UpdatePaymentDto, UpdateUserDto } from './dto.js';

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

  /** Edit a platform account (name, phone, role, approval/expiry — audited). */
  @Patch('users/:userId')
  updateUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.admin.updateUser(admin.userId, userId, dto, this.meta(req));
  }

  /** Soft-delete a platform account (history preserved, audited). */
  @Delete('users/:userId')
  deleteUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.admin.deleteUser(admin.userId, userId, this.meta(req));
  }

  /** Reject a pending signup (triage from the reviews queue). */
  @Post('reviews/:userId/reject')
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.admin.rejectUser(admin.userId, userId, this.meta(req));
  }

  /** Issue a one-time temporary password for an account (returned once, audited). */
  @Post('users/:userId/reset-password')
  resetPassword(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.admin.resetUserPassword(admin.userId, userId, this.meta(req));
  }

  /** Edit a business profile (audited). */
  @Patch('businesses/:businessId')
  updateBusiness(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessDto,
    @Req() req: Request,
  ) {
    return this.admin.updateBusiness(admin.userId, businessId, dto, this.meta(req));
  }

  /** Soft-delete a business (refused while it still has an active team). */
  @Delete('businesses/:businessId')
  deleteBusiness(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Req() req: Request,
  ) {
    return this.admin.deleteBusiness(admin.userId, businessId, this.meta(req));
  }

  /** Subscription payment ledger (newest first). */
  @Get('payments')
  payments(@Query() query: ListPaymentsQuery) {
    return this.admin.listPayments(query);
  }

  /** Record a subscription payment and extend the payer's subscription. */
  @Post('payments')
  recordPayment(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: RecordPaymentDto,
    @Req() req: Request,
  ) {
    return this.admin.recordPayment(admin.userId, dto, this.meta(req));
  }

  /** Correct a payment's money details (granted period is immutable). */
  @Patch('payments/:paymentId')
  updatePayment(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
    @Body() dto: UpdatePaymentDto,
    @Req() req: Request,
  ) {
    return this.admin.updatePayment(admin.userId, paymentId, dto, this.meta(req));
  }

  /** Void a payment and reverse its subscription extension. */
  @Delete('payments/:paymentId')
  voidPayment(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
    @Req() req: Request,
  ) {
    return this.admin.voidPayment(admin.userId, paymentId, this.meta(req));
  }
}