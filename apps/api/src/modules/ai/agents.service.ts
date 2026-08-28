import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  debtConcentrationSeverity,
  lowStockSeverity,
  rankLowStock,
  rankSlowMovers,
  type Insight,
  type LowStockRow,
  type SlowMoverRow,
  type TopSellerRow,
} from './agents.logic.js';

const dec = (v: number | string | Prisma.Decimal): Prisma.Decimal =>
  new Prisma.Decimal(String(v));
const ZERO = new Prisma.Decimal(0);
const money = (v: Prisma.Decimal): Prisma.Decimal =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/**
 * The autonomous "study the business" layer. These agents run over real ledger data and
 * emit proactive, deterministic insights — they need no model, so they work identically in
 * live and mock (no-key) modes. An LLM can later narrate them, but the substance is here.
 */
@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async insights(businessId: string, { limit = 12 } = {}): Promise<Insight[]> {
    const all: Insight[] = [];
    const push = (i: Omit<Insight, 'id'>) =>
      all.push({ ...i, id: `${i.type}:${all.length}` });

    const productCount = await this.prisma.product.count({
      where: { businessId, deletedAt: null },
    });
    if (productCount === 0) {
      push({
        type: 'onboarding',
        severity: 'info',
        title: 'Start with your catalogue',
        body: 'Add your products with cost and selling prices so I can track stock, margins and reorder alerts.',
      });
      return all.slice(0, limit);
    }

    await this.stockInsights(businessId, push);
    await this.salesInsights(businessId, push);
    await this.debtInsights(businessId, push);
    await this.cashInsights(businessId, push);
    await this.expenseInsights(businessId, push);

    return all.slice(0, limit);
  }

  private async stockInsights(
    businessId: string,
    push: (i: Omit<Insight, 'id'>) => void,
  ): Promise<void> {
    const lows = await this.prisma.$queryRaw<LowStockRow[]>`
      SELECT id AS "productId", name, "stockQuantity"::text AS "stockQuantity",
             "reorderLevel"::text AS "reorderLevel"
      FROM "Product"
      WHERE "businessId" = ${businessId} AND "deletedAt" IS NULL
        AND "trackInventory" = true AND "stockQuantity" <= "reorderLevel"
    `;
    const ranked = rankLowStock(lows);
    const sev = lowStockSeverity(ranked.length);
    if (ranked.length === 0) return;
    push({
      type: 'low_stock',
      severity: sev,
      title:
        ranked.length === 1
          ? `Restock ${ranked[0]!.name}`
          : `${ranked.length} products are at or below reorder level`,
      body: ranked
        .map(
          (r) =>
            `${r.name} (have ${money(dec(r.stockQuantity))}, need ${money(dec(r.reorderLevel))} minimum)`,
        )
        .join(' · '),
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const movers = await this.prisma.$queryRaw<SlowMoverRow[]>`
      SELECT p.id AS "productId", p.name, p."stockQuantity"::text AS "stockQuantity",
             p."costPrice"::text AS "costPrice"
      FROM "Product" p
      WHERE p."businessId" = ${businessId} AND p."deletedAt" IS NULL
        AND p."trackInventory" = true AND p."stockQuantity" > 20
        AND NOT EXISTS (
          SELECT 1 FROM "SaleItem" si
          JOIN "Sale" s ON s.id = si."saleId"
          WHERE si."productId" = p.id AND s."businessId" = ${businessId}
            AND s.status = 'COMPLETED' AND s."soldAt" >= ${thirtyDaysAgo}
        )
      ORDER BY p."stockQuantity" * p."costPrice" DESC
      LIMIT 5
    `;
    const slow = rankSlowMovers(movers);
    if (slow.length) {
      const total = slow.reduce((acc, r) => acc.plus(dec(r.tiedUp)), ZERO);
      push({
        type: 'slow_movers',
        severity: 'warn',
        title: `Capital tied up in slow movers (${money(total)})`,
        body: `${slow.map((r) => r.name).join(', ')} haven't sold in 30 days but carry stock. Consider a promotion or returning units to the supplier.`,
      });
    }
  }

  private async salesInsights(
    businessId: string,
    push: (i: Omit<Insight, 'id'>) => void,
  ): Promise<void> {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const top = await this.prisma.$queryRaw<TopSellerRow[]>`
      SELECT p.id AS "productId", p.name, COALESCE(SUM(si."lineTotal"),0)::text AS revenue
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      JOIN "Product" p ON p.id = si."productId"
      WHERE si."businessId" = ${businessId} AND s.status = 'COMPLETED'
        AND s."soldAt" >= ${since}
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 1
    `;
    const best = top[0];
    if (best) {
      push({
        type: 'best_seller',
        severity: 'info',
        title: `“${best.name}” is your top seller`,
        body: `It drove ${money(dec(best.revenue))} in the last 14 days. Keep it well stocked and consider featuring it.`,
      });
    }
  }

  private async debtInsights(
    businessId: string,
    push: (i: Omit<Insight, 'id'>) => void,
  ): Promise<void> {
    const [totalAgg, topAgg, count] = await Promise.all([
      this.prisma.customer.aggregate({
        where: { businessId, deletedAt: null, balance: { gt: 0 } },
        _sum: { balance: true },
      }),
      this.prisma.customer.findFirst({
        where: { businessId, deletedAt: null, balance: { gt: 0 } },
        orderBy: { balance: 'desc' },
        select: { name: true, balance: true },
      }),
      this.prisma.customer.count({
        where: { businessId, deletedAt: null, balance: { gt: 0 } },
      }),
    ]);

    const total = totalAgg._sum.balance ?? ZERO;
    if (total.lessThanOrEqualTo(0)) return;
    const topBal = topAgg?.balance ?? ZERO;
    const share = Number(topBal.dividedBy(total).times(100));
    push({
      type: 'debtors',
      severity: debtConcentrationSeverity(total.toString(), topBal.toString(), share),
      title: `Customers owe ${money(total)} across ${count} account${count === 1 ? '' : 's'}`,
      body:
        topAgg && share >= 40
          ? `${topAgg.name} alone owes ${money(topBal)} (${Math.round(share)}% of all debt). Prioritise a follow-up.`
          : `Chase the larger balances to keep cash flowing before they age past thirty days.`,
    });
  }

  private async cashInsights(
    businessId: string,
    push: (i: Omit<Insight, 'id'>) => void,
  ): Promise<void> {
    const open = await this.prisma.cashSession.findFirst({
      where: { businessId, status: 'OPEN' },
      select: { id: true },
    });
    if (!open) {
      push({
        type: 'cash',
        severity: 'info',
        title: 'No open till',
        body: 'Your till isn’t open. Open one before you start taking cash so sales are tracked against a session.',
      });
      return;
    }
    const agg = await this.prisma.cashMovement.aggregate({
      where: { businessId, sessionId: open.id },
      _sum: { amount: true },
    });
    const cash = agg._sum.amount ?? ZERO;
    if (cash.lessThan(0)) {
      push({
        type: 'cash',
        severity: 'critical',
        title: 'Till is negative',
        body: `The open session shows ${money(cash)} in hand. Check for unrecorded expenses or unbanked cash before you close.`,
      });
    }
  }

  private async expenseInsights(
    businessId: string,
    push: (i: Omit<Insight, 'id'>) => void,
  ): Promise<void> {
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mPrevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [thisMonth, lastMonth] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { businessId, voidedAt: null, paidAt: { gte: mStart } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          businessId,
          voidedAt: null,
          paidAt: { gte: mPrevStart, lt: mStart },
        },
        _sum: { amount: true },
      }),
    ]);
    const cur = thisMonth._sum.amount ?? ZERO;
    const prev = lastMonth._sum.amount ?? ZERO;
    if (prev.greaterThan(0) && cur.greaterThan(prev.times(1.3))) {
      push({
        type: 'expenses',
        severity: 'warn',
        title: `${money(cur)} spent this month so far`,
        body: `That's ${Math.round(Number(cur.dividedBy(prev).times(100)))}% of last month's ${money(prev)} — and the month isn't over. Watch the spend.`,
      });
    }
  }
}
