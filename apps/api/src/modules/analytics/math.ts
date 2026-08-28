import { Prisma } from '@prisma/client';

type NumLike = number | string | Prisma.Decimal;

const dec = (v: NumLike): Prisma.Decimal => new Prisma.Decimal(String(v));
const ZERO = new Prisma.Decimal(0);
const money = (v: Prisma.Decimal): Prisma.Decimal =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/** Gross margin as a whole percentage (0–100), 0 when revenue is zero. */
export function marginPct(revenue: NumLike, grossProfit: NumLike): number {
  const r = money(dec(revenue));
  const gp = money(dec(grossProfit));
  if (r.lessThanOrEqualTo(0)) return 0;
  return Math.round(Number(gp.dividedBy(r).times(100)));
}

interface TrendSource {
  date: string; // YYYY-MM-DD (local)
  revenue: NumLike;
  cogs: NumLike;
}

export interface TrendRow {
  date: string;
  revenue: string;
  cogs: string;
  profit: string;
}

/** Local YYYY-MM-DD key. */
export function toLocalDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Fills a continuous local-day series of `days` entries ending at `endDate`. Zero-fills
 * missing days so a chart can draw a clean line without gaps.
 */
export function buildTrend(
  days: number,
  endDate: Date,
  sources: TrendSource[],
): TrendRow[] {
  const byDay = new Map<string, { revenue: Prisma.Decimal; cogs: Prisma.Decimal }>();
  for (const s of sources) {
    const cur = byDay.get(s.date) ?? { revenue: ZERO, cogs: ZERO };
    cur.revenue = cur.revenue.plus(dec(s.revenue));
    cur.cogs = cur.cogs.plus(dec(s.cogs));
    byDay.set(s.date, cur);
  }
  const start = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const out: TrendRow[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const label = toLocalDateKey(d);
    const row = byDay.get(label) ?? { revenue: ZERO, cogs: ZERO };
    const revenue = money(row.revenue);
    const cogs = money(row.cogs);
    out.push({
      date: label,
      revenue: revenue.toString(),
      cogs: cogs.toString(),
      profit: money(revenue.minus(cogs)).toString(),
    });
  }
  return out;
}
