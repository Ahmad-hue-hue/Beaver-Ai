import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@beaver/shared';
import {
  BusinessId,
  CurrentUser,
  RequirePermissions,
} from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { ConversationsService } from './conversations.service.js';
import { CreateConversationDto } from './dto.js';

@ApiTags('ai')
@Controller('ai/conversations')
@RequirePermissions(PERMISSIONS.AI_ASSISTANT_USE)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  /** Own threads for this user + shop, newest first. */
  @Get()
  list(@BusinessId() businessId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.conversations.list(actor.userId, businessId);
  }

  /** Start a new private thread for this user + shop. */
  @Post()
  create(
    @BusinessId() businessId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversations.create(actor.userId, businessId, dto.title);
  }

  /** Readable transcript (user + assistant turns) of an owned thread. */
  @Get(':id/messages')
  messages(
    @BusinessId() businessId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.conversations.threadView(actor.userId, businessId, id);
  }

  /** Soft-delete an owned thread. */
  @Delete(':id')
  remove(
    @BusinessId() businessId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.conversations.remove(actor.userId, businessId, id);
  }
}
