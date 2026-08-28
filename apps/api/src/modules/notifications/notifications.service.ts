import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { dailySummaryMessage, debtMessage, fmtMoney, lowStockMessage } from './notifications.logic.js';

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

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
   * Generate today's notifications from current signals, idempotently. Called by the web app
   * (and a lightweight scheduler could call it daily). Low-stock/debt/daily are each keyed by
   * day so duplicates never stack.
   */
  async generate(businessId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const created: string[] = [];

    const productCount = await this.prisma.product.count({
      where: { businessId, deletedAt: null },
    });
    if (productCount === 0) {
      const n = await this.create(businessId, {
        kind: 'onboarding',
        severity: 'info',
        title: 'Start with your catalogue',
        body: 'Add products with cost and selling prices so we can track stock, margins and reorder alerts.',
        link: '/products',
        refKey: `onboarding:${today}`,
      });
      if (n) created.push(n.id);
      return { created };
    }

    const [lowStockN, debtN, salesN] = await Promise.all([
      this.generateLowStock(businessId, today),
      this.generateDebt(businessId, today),
      this.generateDailySales(businessId, today),
    ]);
    for (const n of [lowStockN, debtN, salesN]) {
      if (n) created.push(n.id);
    }
    return { created };
  }

  private async generateLowStock(businessId: string, today: string) {
    const lows = await this.prisma.$queryRaw<
      Array<{ name: string; stockQuantity: string }>
    >`
      SELECT name, "stockQuantity"::text AS "stockQuantity"
      FROM "Product"
      WHERE "businessId" = ${businessId} AND "deletedAt" IS NULL
        AND "trackInventory" = true AND "stockQuantity" <= "reorderLevel"
      ORDER BY "stockQuantity" - "reorderLevel" ASC
      LIMIT 8
    `;
    if (lows.length === 0) return null;
    const msg = lowStockMessage({ count: lows.length, names: lows.map((l) => l.name) });
    return this.create(businessId, {
      kind: 'low_stock',
      severity: msg.severity,
      title: msg.title,
      body: msg.body,
      link: '/purchases',
      refKey: `low_stock:${today}`,
    });
  }

  private async generateDebt(businessId: string, today: string) {
    const agg = await this.prisma.customer.aggregate({
      where: { businessId, deletedAt: null, balance: { gt: 0 } },
      _sum: { balance: true },
      _count: true,
    });
    const total = agg._sum.balance ?? new Prisma.Decimal(0);
    if (total.lessThanOrEqualTo(0)) return null;
    const msg = debtMessage(total, agg._count);
    return this.create(businessId, {
      kind: 'debt',
      severity: msg.severity,
      title: msg.title,
      body: msg.body,
      link: '/customers',
      refKey: `debt:${today}`,
    });
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
