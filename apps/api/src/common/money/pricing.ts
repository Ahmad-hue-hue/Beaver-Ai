import { Prisma } from '@prisma/client';

/**
 * Decimal-based pricing math for the backend. All money/margin figures are computed here
 * with `Prisma.Decimal` (decimal.js) — never JS floats. Ratios are fractions in [0, 1).
 */

const D = Prisma.Decimal;
export type Decimalish = Prisma.Decimal | string | number;

const ZERO = new D(0);

/** Gross margin fraction = (price - cost) / price. Returns 0 when price is 0. */
export function grossMargin(cost: Decimalish, price: Decimalish): Prisma.Decimal {
  const p = new D(price);
  if (p.isZero()) return ZERO;
  return p.minus(cost).div(p);
}

/** Markup fraction = (price - cost) / cost. Returns 0 when cost is 0. */
export function markup(cost: Decimalish, price: Decimalish): Prisma.Decimal {
  const c = new D(cost);
  if (c.isZero()) return ZERO;
  return new D(price).minus(c).div(c);
}

/** Per-unit gross profit = price - cost. */
export function unitProfit(cost: Decimalish, price: Decimalish): Prisma.Decimal {
  return new D(price).minus(cost);
}

/**
 * Suggested selling price for a target gross margin (0..0.99): cost / (1 - margin).
 * Rounded to 2 decimals (half-up). e.g. cost 8500, margin 0.2 → 10625.00.
 */
export function priceForMargin(cost: Decimalish, targetMargin: Decimalish): Prisma.Decimal {
  const m = D.max(ZERO, D.min(new D(targetMargin), new D('0.99')));
  return new D(cost).div(new D(1).minus(m)).toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/** True when selling below cost (a losing price). */
export function isBelowCost(cost: Decimalish, price: Decimalish): boolean {
  return new D(price).lessThan(cost);
}
