import { Prisma } from '@prisma/client';

const dec = (v: number | string | Prisma.Decimal): Prisma.Decimal =>
  new Prisma.Decimal(String(v));
const ZERO = new Prisma.Decimal(0);

export type Severity = 'info' | 'warn' | 'critical';

export interface Insight {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  body: string;
}

export interface LowStockRow {
  productId: string;
  name: string;
  stockQuantity: string;
  reorderLevel: string;
}

export interface SlowMoverRow {
  productId: string;
  name: string;
  stockQuantity: string;
  costPrice: string;
}

export interface TopSellerRow {
  productId: string;
  name: string;
  revenue: string;
}

export interface DebtorRow {
  customerId: string;
  name: string;
  balance: string;
}

/** Rank which low-stock products to surface, most urgent (missing most) first. */
export function rankLowStock(
  rows: LowStockRow[],
  cap = 5,
): Array<LowStockRow & { shortfall: string }> {
  return rows
    .map((r) => {
      const stock = dec(r.stockQuantity);
      const reorder = dec(r.reorderLevel);
      return { ...r, shortfall: stock.lessThan(0) ? ZERO.minus(stock).toString() : reorder.minus(stock).toString() };
    })
    .sort((a, b) => dec(b.shortfall).comparedTo(dec(a.shortfall)))
    .slice(0, cap);
}

export function lowStockSeverity(count: number): Severity {
  if (count >= 5) return 'critical';
  if (count >= 1) return 'warn';
  return 'info';
}

/** Slow movers with the most capital tied up (stock × cost), largest first. */
export function rankSlowMovers(
  rows: SlowMoverRow[],
  cap = 5,
): Array<SlowMoverRow & { tiedUp: string }> {
  return rows
    .map((r) => ({ ...r, tiedUp: dec(r.stockQuantity).times(dec(r.costPrice)).toString() }))
    .sort((a, b) => dec(b.tiedUp).comparedTo(dec(a.tiedUp)))
    .slice(0, cap);
}

export function debtConcentrationSeverity(
  totalBalance: string,
  topBalance: string,
  topSharePct: number,
): Severity {
  const total = dec(totalBalance);
  if (total.lessThanOrEqualTo(0)) return 'info';
  if (topSharePct >= 80 && total.greaterThan(0)) return 'critical';
  if (topSharePct >= 50) return 'warn';
  if (dec(topBalance).greaterThan(0)) return 'info';
  return 'info';
}
