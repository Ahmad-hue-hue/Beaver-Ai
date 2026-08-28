import { Prisma } from '@prisma/client';

/**
 * Deterministic Decimal money math for sale returns/refunds. A refund is proportional to what
 * was actually charged for the returned line (including its tax/discount): `refundAmount =
 * lineTotal / quantity * returnQty`, rounded to 2 dp half-up. A line can never be returned for
 * more than what is still returnable (sold minus already-returned).
 */

const D = Prisma.Decimal;
export type Decimalish = Prisma.Decimal | string | number;

const ZERO = new D(0);
const money = (v: Prisma.Decimal): Prisma.Decimal => v.toDecimalPlaces(2, D.ROUND_HALF_UP);

export class ReturnValidationError extends Error {}

export interface ReturnLineInput {
  saleItemId: string;
  /** Name of the line, used in over-return error messages. */
  name: string;
  /** Amount actually charged for the line (incl. its tax/discount). */
  lineTotal: Decimalish;
  /** Quantity sold on the line. */
  quantity: Decimalish;
  /** Quantity of this line already returned (from prior returns). */
  alreadyReturned: Decimalish;
  /** Quantity requested to return now. */
  returnQty: Decimalish;
}

export interface PlannedReturn {
  saleItemId: string;
  quantity: Prisma.Decimal; // the qty being returned now
  remaining: Prisma.Decimal; // qty still returnable after this return
  refundAmount: Prisma.Decimal;
}

/**
 * Validate and compute per-line refunds. Throws `ReturnValidationError` (carrying a
 * human-readable message) if any line is over-returned.
 */
export function planReturns(lines: ReturnLineInput[]): PlannedReturn[] {
  const planned: PlannedReturn[] = [];
  for (const line of lines) {
    const qty = new D(line.returnQty);
    if (qty.lessThanOrEqualTo(ZERO)) {
      throw new ReturnValidationError(
        `Return quantity for "${line.name}" must be greater than 0 (got ${qty.toString()}).`,
      );
    }
    const alreadyReturned = new D(line.alreadyReturned);
    const remaining = new D(line.quantity).minus(alreadyReturned);
    if (qty.greaterThan(remaining)) {
      throw new ReturnValidationError(
        `Cannot return ${qty.toString()} of "${line.name}" — only ${remaining.toString()} remaining.`,
      );
    }
    const unitRefund = new D(line.lineTotal).div(new D(line.quantity));
    const refundAmount = money(unitRefund.times(qty));
    planned.push({ saleItemId: line.saleItemId, quantity: qty, remaining, refundAmount });
  }
  return planned;
}

/** Sum of the planned refunds, rounded to 2 dp. */
export function refundTotal(planned: PlannedReturn[]): Prisma.Decimal {
  return money(planned.reduce<Prisma.Decimal>((s, p) => s.plus(p.refundAmount), ZERO));
}
