import { Prisma } from '@prisma/client';

/**
 * Deterministic till reconciliation math. An OPENING_BALANCE float plus the sum of all session
 * movements gives the expected cash; the physical count determines the variance.
 */

const D = Prisma.Decimal;
export type Decimalish = Prisma.Decimal | string | number;

const ZERO = new D(0);
const money = (v: Prisma.Decimal): Prisma.Decimal => v.toDecimalPlaces(2, D.ROUND_HALF_UP);

export interface ReconcileResult {
  expectedCash: Prisma.Decimal;
  variance: Prisma.Decimal; // counted - expected
  adjustment: Prisma.Decimal; // non-zero only when the ledger must be corrected to the count
}

/**
 * Compute expected cash and variance for a session.
 * @param openingBalance the float recorded when the session opened
 * @param signedMovements the session's movements (+ in, - out)
 * @param countedCash the physical cash counted at close
 */
export function reconcile(
  openingBalance: Decimalish,
  signedMovements: Decimalish[],
  countedCash: Decimalish,
): ReconcileResult {
  const net = signedMovements.reduce<Prisma.Decimal>((sum, m) => sum.plus(new D(m)), ZERO);
  const expectedCash = money(new D(openingBalance).plus(net));
  const variance = money(new D(countedCash).minus(expectedCash));
  return { expectedCash, variance, adjustment: variance };
}
