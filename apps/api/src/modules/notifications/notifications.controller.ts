import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, RequirePermissions } from '../../common/auth/decorators.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  list(@BusinessId() businessId: string, @Query('limit') limit?: string) {
    return this.notifications.list(businessId, Number(limit) || undefined);
  }

  @Get('unread-count')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  unreadCount(@BusinessId() businessId: string) {
    return this.notifications.unreadCount(businessId);
  }

  @Post('generate')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  generate(@BusinessId() businessId: string) {
    return this.notifications.generate(businessId);
  }

  @Post('read-all')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  markAllRead(@BusinessId() businessId: string) {
    return this.notifications.markAllRead(businessId);
  }

  @Post(':id/read')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  markRead(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.notifications.markRead(businessId, id);
  }
}
