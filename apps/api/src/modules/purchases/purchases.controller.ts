import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { PurchasesService } from './purchases.service.js';
import { CreatePurchaseDto, ListPurchasesQuery } from './dto.js';

@ApiTags('purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PURCHASES_VIEW)
  list(@BusinessId() businessId: string, @Query() query: ListPurchasesQuery) {
    return this.purchases.list(businessId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PURCHASES_VIEW)
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.purchases.findOne(businessId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  create(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePurchaseDto,
    @Req() req: Request,
  ) {
    return this.purchases.create(businessId, user.userId, dto, this.meta(req));
  }

  @Post(':id/receive')
  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  receive(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.purchases.receive(businessId, user.userId, id, this.meta(req));
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  cancel(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.purchases.cancel(businessId, user.userId, id, this.meta(req));
  }
}
