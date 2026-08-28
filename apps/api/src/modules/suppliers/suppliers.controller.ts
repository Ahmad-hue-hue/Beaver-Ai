import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { SuppliersService } from './suppliers.service.js';
import { CreateSupplierDto, ListSuppliersQuery } from './dto.js';

@ApiTags('suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SUPPLIERS_VIEW)
  list(@BusinessId() businessId: string, @Query() query: ListSuppliersQuery) {
    return this.suppliers.list(businessId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_VIEW)
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.suppliers.findOne(businessId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUPPLIERS_MANAGE)
  create(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupplierDto,
    @Req() req: Request,
  ) {
    return this.suppliers.create(businessId, user.userId, dto, this.meta(req));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_MANAGE)
  update(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateSupplierDto,
    @Req() req: Request,
  ) {
    return this.suppliers.update(businessId, user.userId, id, dto, this.meta(req));
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SUPPLIERS_MANAGE)
  remove(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.suppliers.remove(businessId, user.userId, id, this.meta(req));
  }
}
