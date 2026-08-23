import { Prisma } from '@prisma/client';

/**
 * Decimal stock math. The signed-quantity convention keeps the ledger simple: every
 * InventoryMovement stores a signed `quantity` (+ increases, - decreases) and the running
 * `balanceAfter`, so summing movements always reproduces the product's stockQuantity.
 */

const D = Prisma.Decimal;
type Decimalish = Prisma.Decimal | string | number;

/** Running balance after applying a signed movement quantity to the current stock. */
export function nextBalance(current: Decimalish, signedQty: Decimalish): Prisma.Decimal {
  return new D(current).plus(signedQty);
}

/** Variance from a physical count = counted - expected (negative = shrinkage/loss). */
export function variance(counted: Decimalish, expected: Decimalish): Prisma.Decimal {
  return new D(counted).minus(expected);
}

/** True when a decrease of `qty` would drive stock below zero. */
export function wouldGoNegative(current: Decimalish, decreaseQty: Decimalish): boolean {
  return new D(current).minus(decreaseQty).lessThan(0);
}

/** At/below the reorder level (and level > 0) → needs reordering. */
export function isLowStock(stock: Decimalish, reorderLevel: Decimalish): boolean {
  const level = new D(reorderLevel);
  if (level.lessThanOrEqualTo(0)) return false;
  return new D(stock).lessThanOrEqualTo(level);
}
