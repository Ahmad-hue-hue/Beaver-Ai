import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, RequirePermissions, RequirePlanFeature } from '../../common/auth/decorators.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW_FINANCIAL)
  @RequirePlanFeature('financialReports')
  overview(@BusinessId() businessId: string) {
    return this.analytics.overview(businessId);
  }

  @Get('stats')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW_FINANCIAL)
  @RequirePlanFeature('financialReports')
  stats(@BusinessId() businessId: string, @Query('period') period?: string) {
    return this.analytics.stats(businessId, period);
  }

  @Get('trend')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW_OPERATIONAL)
  trend(
    @BusinessId() businessId: string,
    @Query('days') days?: string,
  ) {
    return this.analytics.trend(businessId, Number(days) || undefined);
  }

  @Get('top-products')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW_OPERATIONAL)
  topProducts(
    @BusinessId() businessId: string,
    @Query('limit') limit?: string,
  ) {
    return this.analytics.topProducts(businessId, Number(limit) || undefined);
  }

  @Get('debtors')
  @RequirePermissions(PERMISSIONS.DEBTS_VIEW)
  debtors(
    @BusinessId() businessId: string,
    @Query('limit') limit?: string,
  ) {
    return this.analytics.debtors(businessId, Number(limit) || undefined);
  }
}
