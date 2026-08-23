import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto, ListCustomersQuery } from './dto.js';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_VIEW)
  list(@BusinessId() businessId: string, @Query() query: ListCustomersQuery) {
    return this.customers.list(businessId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_VIEW)
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.customers.findOne(businessId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  create(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
    @Req() req: Request,
  ) {
    return this.customers.create(businessId, user.userId, dto, this.meta(req));
  }
}
