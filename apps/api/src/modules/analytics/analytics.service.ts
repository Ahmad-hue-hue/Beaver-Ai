import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CacheService } from '../../common/cache/cache.service.js';
import { buildTrend, marginPct, toLocalDateKey } from './math.js';

const dec = (v: number | string | Prisma.Decimal): Prisma.Decimal =>
  new Prisma.Decimal(String(v));
const ZERO = new Prisma.Decimal(0);
const money = (v: Prisma.Decimal): Prisma.Decimal =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

interface TopProduct {
  productId: string;
  name: string;
  quantity: string;
  revenue: string;
  grossProfit: string;
  marginPct: string;
}

interface DebtorRow {
  customerId: string;
  name: string;
  balance: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** KPI bundle for the dashboard header. */
  async overview(businessId: string) {
    const key = CacheService.key(businessId, 'dashboard', 'overview');
    return this.cache.getOrSet(key, 30, async () => {
      const range = AnalyticsService.rangeFor('today')!;
      const where: Prisma.SaleWhereInput = { businessId, status: 'COMPLETED', soldAt: range };

      const [agg, itemAgg, openSession, debtAgg, stockAgg, lowStock, expenseAgg] =
        await Promise.all([
          this.prisma.sale.aggregate({
            where,
            _sum: { total: true, discountTotal: true },
            _count: true,
          }),
          this.prisma.saleItem.aggregate({
            where: { businessId, sale: { status: 'COMPLETED', soldAt: range } },
            _sum: { quantity: true },
          }),
          this.openSessionBalance(businessId),
          this.prisma.customer.aggregate({
            where: { businessId, deletedAt: null, balance: { gt: 0 } },
            _sum: { balance: true },
          }),
          this.prisma.product.aggregate({
            where: { businessId, deletedAt: null, trackInventory: true },
            _sum: { stockQuantity: true },
          }),
          this.countLowStock(businessId),
          this.prisma.expense.aggregate({
            where: { businessId, voidedAt: null, paidAt: range },
            _sum: { amount: true },
          }),
        ]);

      const revenue = money(agg._sum.total ?? ZERO);
      const cogs = await this.cogsForRange(businessId, range);
      const grossProfit = money(revenue.minus(cogs));

      return {
        period: 'today',
        sales: {
          count: agg._count,
          revenue: revenue.toString(),
          itemsSold: (itemAgg._sum.quantity ?? ZERO).toString(),
        },
        profit: {
          revenue: revenue.toString(),
          cogs: cogs.toString(),
          grossProfit: grossProfit.toString(),
        },
        expenses: (expenseAgg._sum.amount ?? ZERO).toString(),
        cashInHand: openSession.cash.toString(),
        debtOutstanding: (debtAgg._sum.balance ?? ZERO).toString(),
        inventory: {
          stockValue: (stockAgg._sum.stockQuantity ?? ZERO).toString(),
          lowStock: lowStock,
        },
      };
    });
  }

  /** Revenue, COGS, gross profit, expenses and net profit for a period. */
  async stats(businessId: string, period = 'today') {
    const key = CacheService.key(businessId, 'profit', period);
    return this.cache.getOrSet(key, 60, async () => {
      const range = AnalyticsService.rangeFor(period) ?? AnalyticsService.rangeFor('today')!;
      const saleWhere: Prisma.SaleWhereInput = { businessId, status: 'COMPLETED', soldAt: range };

      const [agg, expenseAgg] = await Promise.all([
        this.prisma.sale.aggregate({
          where: saleWhere,
          _sum: { total: true, discountTotal: true },
          _count: true,
        }),
        this.prisma.expense.aggregate({
          where: { businessId, voidedAt: null, paidAt: range },
          _sum: { amount: true },
        }),
      ]);

      const revenue = money(agg._sum.total ?? ZERO);
      const cogs = await this.cogsForRange(businessId, range);
      const grossProfit = money(revenue.minus(cogs));
      const expenses = money(expenseAgg._sum.amount ?? ZERO);
      const netProfit = money(grossProfit.minus(expenses));

      return {
        period,
        salesCount: agg._count,
        revenue: revenue.toString(),
        cogs: cogs.toString(),
        grossProfit: grossProfit.toString(),
        expenses: expenses.toString(),
        netProfit: netProfit.toString(),
        marginPct: marginPct(revenue, grossProfit),
      };
    });
  }

  /** Daily revenue/COGS/profit series for a simple sparkline over the last N days. */
  async trend(businessId: string, days = 14) {
    const n = Math.min(Math.max(days, 7), 90);
    const key = CacheService.key(businessId, 'sales', `trend:${n}`);
    return this.cache.getOrSet(key, 120, async () => {
      const start = new Date();
      start.setDate(start.getDate() - (n - 1));
      start.setHours(0, 0, 0, 0);

      const sales = await this.prisma.sale.findMany({
        where: { businessId, status: 'COMPLETED', soldAt: { gte: start } },
        select: { total: true, soldAt: true, items: { select: { lineTotal: true } } },
        orderBy: { soldAt: 'asc' },
      });

      const sources = sales.map((s) => ({
        date: toLocalDateKey(s.soldAt),
        revenue: s.total,
        cogs: s.items.reduce((acc, i) => acc.plus(dec(i.lineTotal)), ZERO),
      }));
      return buildTrend(n, new Date(), sources);
    });
  }

  /** Best-selling products by revenue with gross margin. */
  async topProducts(businessId: string, limit = 10) {
    const n = Math.min(Math.max(limit, 5), 50);
    const key = CacheService.key(businessId, 'sales', `top:${n}`);
    return this.cache.getOrSet(key, 120, async () => {
      const rows: TopProduct[] = await this.prisma.$queryRaw`
        SELECT
          p.id AS "productId",
          p.name AS name,
          COALESCE(SUM(si."quantity"), 0)::text AS quantity,
          COALESCE(SUM(si."lineTotal"), 0)::text AS revenue,
          COALESCE(SUM(si."lineTotal" - si."costSnapshot" * si."quantity"), 0)::text AS "grossProfit"
        FROM "SaleItem" si
        JOIN "Sale" s ON s.id = si."saleId"
        JOIN "Product" p ON p.id = si."productId"
        WHERE si."businessId" = ${businessId}
          AND s.status = 'COMPLETED'
          AND s."voidedAt" IS NULL
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT ${n}
      `;

      return rows.map((r) => {
        const revenue = money(dec(r.revenue));
        const gp = money(dec(r.grossProfit));
        return {
          ...r,
          quantity: dec(r.quantity).toDecimalPlaces(0).toString(),
          revenue: revenue.toString(),
          grossProfit: gp.toString(),
          marginPct: marginPct(revenue, gp),
        };
      });
    });
  }

  /** Customers currently owing money, largest first. */
  async debtors(businessId: string, limit = 10) {
    const n = Math.min(Math.max(limit, 5), 100);
    const key = CacheService.key(businessId, 'debts', `debtors:${n}`);
    return this.cache.getOrSet(key, 60, async () => {
      const rows: DebtorRow[] = await this.prisma.$queryRaw`
        SELECT
          id AS "customerId",
          name,
          balance::text AS balance
        FROM "Customer"
        WHERE "businessId" = ${businessId}
          AND "deletedAt" IS NULL
          AND balance > 0
        ORDER BY balance DESC
        LIMIT ${n}
      `;
      return rows.map((r) => ({ ...r, balance: money(dec(r.balance)).toString() }));
    });
  }

  // ─────────────────────────── Privates ───────────────────────────

  private async cogsForRange(
    businessId: string,
    range: Prisma.DateTimeFilter,
  ): Promise<Prisma.Decimal> {
    // COGS = Σ (costSnapshot × quantity) for COMPLETED sales in the range.
    const rows = await this.prisma.$queryRaw<Array<{ v: string }>>`
      SELECT COALESCE(SUM(si."costSnapshot" * si."quantity"), 0)::text AS v
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      WHERE si."businessId" = ${businessId}
        AND s.status = 'COMPLETED'
        AND s."soldAt" >= ${range.gte ?? new Date(0)}
        ${range.lt ? Prisma.sql`AND s."soldAt" < ${range.lt}` : Prisma.empty}
    `;
    return dec(rows[0]?.v ?? '0');
  }

  private async openSessionBalance(businessId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { businessId, status: 'OPEN' },
      select: { id: true },
    });
    if (!session) return { cash: ZERO };
    const agg = await this.prisma.cashMovement.aggregate({
      where: { businessId, sessionId: session.id },
      _sum: { amount: true },
    });
    return { cash: agg._sum.amount ?? ZERO, sessionId: session.id };
  }

  /** Product count where stock <= reorderLevel (column-to-column, raw SQL). */
  private async countLowStock(businessId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ v: bigint }>>`
      SELECT COUNT(*)::bigint AS v
      FROM "Product"
      WHERE "businessId" = ${businessId}
        AND "deletedAt" IS NULL
        AND "trackInventory" = true
        AND "stockQuantity" <= "reorderLevel"
    `;
    return Number(rows[0]?.v ?? 0);
  }

  private static rangeFor(period: string): Prisma.DateTimeFilter | undefined {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'today') {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { gte: start, lt: end };
    }
    if (period === 'week') {
      const s = new Date(start);
      s.setDate(s.getDate() - 6);
      return { gte: s };
    }
    if (period === 'month') {
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
    return undefined;
  }
}
