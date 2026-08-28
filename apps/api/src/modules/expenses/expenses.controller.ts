import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { ExpensesService } from './expenses.service.js';
import { CreateExpenseDto, ListExpensesQuery } from './dto.js';

@ApiTags('expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.EXPENSES_VIEW)
  list(@BusinessId() businessId: string, @Query() query: ListExpensesQuery) {
    return this.expenses.list(businessId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EXPENSES_VIEW)
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.expenses.findOne(businessId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EXPENSES_MANAGE)
  create(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExpenseDto,
    @Req() req: Request,
  ) {
    return this.expenses.create(businessId, user.userId, dto, this.meta(req));
  }
}
