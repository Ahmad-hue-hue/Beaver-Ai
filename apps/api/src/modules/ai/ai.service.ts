import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { AI_PROVIDER } from '../../common/ai/ai.constants.js';
import type { AiProvider, ChatMessage } from '../../common/ai/ai.provider.js';
import { AgentsService } from './agents.service.js';

const money = (v: Prisma.Decimal | string | number): string => {
  const d = new Prisma.Decimal(String(v));
  return `TZS ${d.toDecimalPlaces(0).toString()}`;
};

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly agents: AgentsService,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  get isLive(): boolean {
    return this.provider.isLive;
  }

  /** Deterministic, always-on proactive insights (no model required). */
  insights(businessId: string, limit?: number) {
    return this.agents.insights(businessId, { limit });
  }

  /** Assistant chat grounded in a snapshot of the business's real data. */
  async chat(businessId: string, history: ChatMessage[]): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });
    const context = await this.contextSnapshot(businessId);

    const system: ChatMessage = {
      role: 'system',
      content:
        `You are Beaver, the assistant embedded in the business operating system for ` +
        `“${business?.name ?? 'this shop'}”, a small Tanzanian retail shop. Answer in the user's language ` +
        `(Kiswahili or English), be concise, practical and specific. Money is in TZS. Use only the ` +
        `business data provided; do not invent figures. If the data is insufficient, say so and ` +
        `suggest what would help. Here is a live snapshot of the business:\n${context}`,
    };

    const reply = await this.provider.complete({
      messages: [system, ...history],
      maxOutputTokens: 800,
      temperature: 0.4,
    });
    return reply.trim();
  }

  private async contextSnapshot(businessId: string): Promise<string> {
    const [overview, stats, insights] = await Promise.all([
      this.analytics.overview(businessId).catch(() => null),
      this.analytics.stats(businessId, 'today').catch(() => null),
      this.agents.insights(businessId, { limit: 5 }),
    ]);

    const lines: string[] = [];
    if (stats) {
      lines.push(
        `Today: ${stats.salesCount} sale(s), revenue ${money(stats.revenue)}, gross profit ${money(stats.grossProfit)}, ` +
          `expenses ${money(stats.expenses)}, net ${money(stats.netProfit)} (${stats.marginPct}% margin).`,
      );
    }
    if (overview) {
      lines.push(
        `Cash in hand: ${money(overview.cashInHand)}. Customers owe ${money(overview.debtOutstanding)}. ` +
          `Stock value ${money(overview.inventory.stockValue)} (${overview.inventory.lowStock} low).`,
      );
    }
    if (insights.length) {
      lines.push('Current flags: ' + insights.map((i) => `${i.title} — ${i.body}`).join(' | '));
    }
    return lines.join('\n') || 'No business data recorded yet.';
  }
}
