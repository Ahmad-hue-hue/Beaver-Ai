import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { DebtsService } from './debts.service.js';
import { CreateCustomerPaymentDto, ListDebtorsQuery } from './dto.js';

@ApiTags('debts')
@Controller('debts')
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Get('overview')
  @RequirePermissions(PERMISSIONS.DEBTS_VIEW)
  overview(@BusinessId() businessId: string, @Query() query: ListDebtorsQuery) {
    return this.debts.overview(businessId, query);
  }

  @Get('aging')
  @RequirePermissions(PERMISSIONS.DEBTS_VIEW)
  aging(@BusinessId() businessId: string) {
    return this.debts.aging(businessId);
  }

  @Get('customers/:id/statement')
  @RequirePermissions(PERMISSIONS.DEBTS_VIEW)
  statement(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.debts.statement(businessId, id);
  }

  @Post('customers/:id/payments')
  @RequirePermissions(PERMISSIONS.DEBTS_MANAGE)
  recordPayment(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateCustomerPaymentDto,
    @Req() req: Request,
  ) {
    return this.debts.recordPayment(businessId, user.userId, id, dto, this.meta(req));
  }
}
