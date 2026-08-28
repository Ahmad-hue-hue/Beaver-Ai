import { Prisma } from '@prisma/client';
import type { DebtTransactionType } from '@prisma/client';

/**
 * FIFO debt aging. Age outstanding credit by when the credit was created (the sale date).
 * Payments/adjustments reduce the oldest outstanding credit first, so each surviving credit's
 * remaining amount is bucketed by its own age: current / 1-30 / 31-60 / 60+ days.
 */

const D = Prisma.Decimal;
const ZERO = new D(0);
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AgingRow {
  type: DebtTransactionType;
  amount: Prisma.Decimal; // signed: + credit, - payment/adjustment
  createdAt: Date;
}

export interface AgingBucket {
  current: Prisma.Decimal;
  days1to30: Prisma.Decimal;
  days31to60: Prisma.Decimal;
  days60plus: Prisma.Decimal;
}

export const EMPTY_BUCKETS: AgingBucket = {
  current: ZERO,
  days1to30: ZERO,
  days31to60: ZERO,
  days60plus: ZERO,
};

/**
 * Compute per-customer aging buckets from a chronological debt ledger for ONE customer.
 * FIFO: payments offset the oldest credits first.
 */
export function ageLedger(
  rows: AgingRow[],
  asOf: Date,
): AgingBucket {
  // Split into credits (chronological) and a running pool of offsets.
  const credits: { amount: Prisma.Decimal; createdAt: Date }[] = [];
  let offsetPool = ZERO;

  for (const row of rows) {
    if (row.type === 'SALE_CREDIT') {
      credits.push({ amount: row.amount, createdAt: row.createdAt });
    } else {
      // PAYMENT (negative) or ADJUSTMENT (signed) reduces outstanding.
      offsetPool = offsetPool.minus(row.amount); // payments are negative → adds to pool
    }
  }

  // Allocate the offset pool against oldest credits first.
  let remainingOffset = offsetPool;
  const unpaid: { amount: Prisma.Decimal; createdAt: Date }[] = [];
  for (const credit of credits) {
    let amount = credit.amount;
    if (remainingOffset.greaterThan(ZERO)) {
      const consume = D.min(amount, remainingOffset);
      amount = amount.minus(consume);
      remainingOffset = remainingOffset.minus(consume);
    }
    if (amount.greaterThan(ZERO)) unpaid.push({ amount, createdAt: credit.createdAt });
  }

  // Bucket the remaining unpaid credits by age.
  const buckets = { ...EMPTY_BUCKETS };
  for (const u of unpaid) {
    const days = Math.floor((asOf.getTime() - u.createdAt.getTime()) / DAY_MS);
    if (days <= 0) buckets.current = buckets.current.plus(u.amount);
    else if (days <= 30) buckets.days1to30 = buckets.days1to30.plus(u.amount);
    else if (days <= 60) buckets.days31to60 = buckets.days31to60.plus(u.amount);
    else buckets.days60plus = buckets.days60plus.plus(u.amount);
  }

  return buckets;
}

/** Sum the four buckets into a single outstanding total. */
export function totalOutstanding(b: AgingBucket): Prisma.Decimal {
  return b.current.plus(b.days1to30).plus(b.days31to60).plus(b.days60plus);
}
