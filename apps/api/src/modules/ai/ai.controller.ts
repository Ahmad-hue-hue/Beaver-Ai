import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@beaver/shared';
import {
  BusinessId,
  CurrentUser,
  RequirePermissions,
} from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { AiService } from './ai.service.js';
import { AiChatDto, InsightsQuery } from './dto.js';
import type { ChatMessage } from '../../common/ai/ai.provider.js';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @RequirePermissions(PERMISSIONS.AI_ASSISTANT_USE)
  status() {
    return {
      provider: this.ai.providerName,
      live: this.ai.isLive,
    };
  }

  @Get('insights')
  @RequirePermissions(PERMISSIONS.AI_INSIGHTS_VIEW)
  insights(@BusinessId() businessId: string, @Query() query: InsightsQuery) {
    return this.ai.insights(businessId, query.limit);
  }

  @Post('chat')
  @RequirePermissions(PERMISSIONS.AI_ASSISTANT_USE)
  async chat(
    @BusinessId() businessId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AiChatDto,
  ) {
    const history: ChatMessage[] = dto.messages
      .map((m) => ({ ...m, content: m.content.trim() }))
      .filter((m) => m.content.length > 0 || (m.images?.length ?? 0) > 0)
      .map((m, idx) => ({
        role: (idx % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
        images: m.images,
      }));
    if (history.length === 0) history.push({ role: 'user', content: '' });
    const result = await this.ai.chat(businessId, actor, history);
    return { ...result, provider: this.ai.providerName, live: this.ai.isLive };
  }
}
