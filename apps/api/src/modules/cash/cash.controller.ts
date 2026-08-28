import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CashService } from './cash.service.js';
import {
  CloseCashSessionDto,
  ListCashMovementsQuery,
  OpenCashSessionDto,
} from './dto.js';

@ApiTags('cash')
@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Get('sessions')
  @RequirePermissions(PERMISSIONS.CASH_MANAGE)
  listSessions(@BusinessId() businessId: string) {
    return this.cash.listSessions(businessId);
  }

  @Get('sessions/current')
  @RequirePermissions(PERMISSIONS.CASH_MANAGE)
  current(@BusinessId() businessId: string) {
    return this.cash.current(businessId);
  }

  @Get('sessions/:id')
  @RequirePermissions(PERMISSIONS.CASH_MANAGE)
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.cash.findOne(businessId, id);
  }

  @Get('movements')
  @RequirePermissions(PERMISSIONS.CASH_MANAGE)
  listMovements(@BusinessId() businessId: string, @Query() query: ListCashMovementsQuery) {
    return this.cash.listMovements(businessId, query);
  }

  @Post('sessions/open')
  @RequirePermissions(PERMISSIONS.CASH_MANAGE)
  open(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OpenCashSessionDto,
    @Req() req: Request,
  ) {
    return this.cash.open(businessId, user.userId, dto, this.meta(req));
  }

  @Post('sessions/:id/close')
  @RequirePermissions(PERMISSIONS.CASH_MANAGE)
  close(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloseCashSessionDto,
    @Req() req: Request,
  ) {
    return this.cash.close(businessId, user.userId, id, dto, this.meta(req));
  }
}
