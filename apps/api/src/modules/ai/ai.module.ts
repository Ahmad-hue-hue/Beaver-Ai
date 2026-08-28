import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AgentsService } from './agents.service.js';

@Module({
  imports: [AnalyticsModule],
  controllers: [AiController],
  providers: [AiService, AgentsService],
  exports: [AiService, AgentsService],
})
export class AiModule {}
