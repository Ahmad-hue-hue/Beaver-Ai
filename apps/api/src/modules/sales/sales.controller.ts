import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { SalesService } from './sales.service.js';
import { CreateReturnDto, CreateSaleDto, ListSalesQuery, SalesSummaryQuery } from './dto.js';

@ApiTags('sales')
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_VIEW)
  list(@BusinessId() businessId: string, @Query() query: ListSalesQuery) {
    return this.sales.list(businessId, query);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.SALES_VIEW)
  summary(@BusinessId() businessId: string, @Query() query: SalesSummaryQuery) {
    return this.sales.summary(businessId, query.period);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALES_VIEW)
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.sales.findOne(businessId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_CREATE)
  create(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSaleDto,
    @Req() req: Request,
  ) {
    return this.sales.create(businessId, user, dto, this.meta(req));
  }

  @Post(':id/void')
  @RequirePermissions(PERMISSIONS.SALES_CANCEL)
  void(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.sales.void(businessId, user, id, this.meta(req));
  }

  @Post(':id/returns')
  @RequirePermissions(PERMISSIONS.SALES_REFUND)
  createReturn(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReturnDto,
    @Req() req: Request,
  ) {
    return this.sales.createReturn(businessId, user, id, dto, this.meta(req));
  }
}
