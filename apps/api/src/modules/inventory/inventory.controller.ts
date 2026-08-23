import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { InventoryService } from './inventory.service.js';
import {
  AdjustStockDto,
  CreateCountDto,
  ListMovementsQuery,
  ReceiveStockDto,
  WriteOffDto,
} from './dto.js';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Get('movements')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  movements(@BusinessId() businessId: string, @Query() query: ListMovementsQuery) {
    return this.inventory.listMovements(businessId, query);
  }

  @Post('receive')
  @RequirePermissions(PERMISSIONS.INVENTORY_RECEIVE)
  receive(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReceiveStockDto,
    @Req() req: Request,
  ) {
    return this.inventory.receive(businessId, user.userId, dto, this.meta(req));
  }

  @Post('adjust')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  adjust(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdjustStockDto,
    @Req() req: Request,
  ) {
    return this.inventory.adjust(businessId, user.userId, dto, this.meta(req));
  }

  @Post('write-off')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  writeOff(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WriteOffDto,
    @Req() req: Request,
  ) {
    return this.inventory.writeOff(businessId, user.userId, dto, this.meta(req));
  }

  @Get('counts')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  listCounts(@BusinessId() businessId: string) {
    return this.inventory.listCounts(businessId);
  }

  @Get('counts/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  getCount(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.inventory.getCount(businessId, id);
  }

  @Post('counts')
  @RequirePermissions(PERMISSIONS.INVENTORY_COUNT)
  createCount(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCountDto,
    @Req() req: Request,
  ) {
    return this.inventory.createCount(businessId, user.userId, dto, this.meta(req));
  }

  @Post('counts/:id/complete')
  @RequirePermissions(PERMISSIONS.INVENTORY_COUNT)
  completeCount(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.inventory.completeCount(businessId, user.userId, id, this.meta(req));
  }
}
