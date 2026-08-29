import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AgentsService } from '../ai/agents.service.js';
import { dailySummaryMessage } from './notifications.logic.js';

const dec = (v: number | string | Prisma.Decimal): Prisma.Decimal =>
  new Prisma.Decimal(String(v));

interface CreateNotificationInput {
  kind: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
  link?: string;
  refKey?: string;
}

/** Where each AI agent insight should deep-link on the web app. */
const INSIGHT_LINKS: Record<string, string> = {
  onboarding: '/products',
  low_stock: '/purchases',
  slow_movers: '/products',
  best_seller: '/products',
  debtors: '/customers',
  cash: '/cash',
  expenses: '/expenses',
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agents: AgentsService,
  ) {}

  async list(businessId: string, limit = 30) {
    const notifications = await this.prisma.notification.findMany({
      where: { businessId },
      orderBy: [{ readAt: 'asc' as const }, { createdAt: 'desc' as const }],
      take: Math.min(Math.max(limit, 1), 100),
    });
    return notifications;
  }

  async unreadCount(businessId: string) {
    const count = await this.prisma.notification.count({
      where: { businessId, readAt: null },
    });
    return { count };
  }

  async markRead(businessId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, businessId },
    });
    if (!notification) return null;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(businessId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { businessId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  /** Create a notification, deduped by (businessId, refKey) when provided. */
  async create(businessId: string, input: CreateNotificationInput) {
    if (input.refKey) {
      const existing = await this.prisma.notification.findFirst({
        where: { businessId, refKey: input.refKey },
        select: { id: true },
      });
      if (existing) return null; // already notified for this key
    }
    return this.prisma.notification.create({
      data: {
        businessId,
        kind: input.kind,
        severity: input.severity,
        title: input.title,
        body: input.body,
        link: input.link,
        refKey: input.refKey,
      },
    });
  }

  /**
   * Generate today's notifications, idempotently. Called by the web app (and a lightweight
   * scheduler could call it daily).
   *
   * The AI "study the business" agents (AgentsService) compute the deterministic insights —
   * restock alerts, top seller, debtors, open-till, slow movers, expense spikes — and each is
   * persisted here as a notification, keyed `ai:<type>:<day>` so duplicates never stack. The
   * daily sales roll-up completes the set. This is how the AI automatically surfaces what
   * needs attention, in the Notifications feed.
   */
  async generate(businessId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const created: string[] = [];

    const [insights, salesN] = await Promise.all([
      this.agents.insights(businessId, { limit: 50 }),
      this.generateDailySales(businessId, today),
    ]);

    for (const insight of insights) {
      const n = await this.create(businessId, {
        kind: insight.type,
        severity: insight.severity,
        title: insight.title,
        body: insight.body,
        link: INSIGHT_LINKS[insight.type],
        refKey: `ai:${insight.type}:${today}`,
      });
      if (n) created.push(n.id);
    }

    if (salesN) created.push(salesN.id);
    return { created };
  }

  private async generateDailySales(businessId: string, today: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [agg, expenses] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { businessId, status: 'COMPLETED', soldAt: { gte: start, lt: end } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { businessId, voidedAt: null, paidAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
    ]);
    const revenue = dec(agg._sum.total?.toString() ?? '0');
    const spent = dec(expenses._sum.amount?.toString() ?? '0');

    const msg = dailySummaryMessage({ revenue, expenses: spent, saleCount: agg._count });
    if (msg.severity === null) return null;
    return this.create(businessId, {
      kind: 'sales_summary',
      severity: msg.severity,
      title: msg.title,
      body: msg.body,
      link: '/reports',
      refKey: `sales_summary:${today}`,
    });
  }
}
