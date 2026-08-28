import { Prisma } from '@prisma/client';

/**
 * Deterministic Decimal money math for a purchase. Mirrors the sale totals (same rounding and
 * discount/tax rules) but on the cost side — this is the money owed to a supplier. A purchase
 * may be under-paid (balanceDue owed) when goods are received before full settlement.
 */

const D = Prisma.Decimal;
export type Decimalish = Prisma.Decimal | string | number;

const ZERO = new D(0);
const money = (v: Prisma.Decimal): Prisma.Decimal => v.toDecimalPlaces(2, D.ROUND_HALF_UP);

export interface PurchaseLineInput {
  unitCost: Decimalish;
  quantity: Decimalish;
  discount?: Decimalish; // per-line discount amount (absolute), default 0
  taxRate?: Decimalish; // fraction 0..1, default 0
}

export interface ComputedPurchaseLine {
  gross: Prisma.Decimal; // unitCost * quantity
  discount: Prisma.Decimal; // clamped to [0, gross]
  taxableBase: Prisma.Decimal; // gross - discount
  tax: Prisma.Decimal;
  lineTotal: Prisma.Decimal; // taxableBase + tax
}

/** Compute one purchase line's money figures. */
export function computePurchaseLine(line: PurchaseLineInput): ComputedPurchaseLine {
  const gross = money(new D(line.unitCost).times(new D(line.quantity)));
  const rawDiscount = line.discount != null ? new D(line.discount) : ZERO;
  const discount = money(D.max(ZERO, D.min(rawDiscount, gross)));
  const taxableBase = gross.minus(discount);
  const tax = money(taxableBase.times(line.taxRate != null ? new D(line.taxRate) : ZERO));
  const lineTotal = taxableBase.plus(tax);
  return { gross, discount, taxableBase, tax, lineTotal };
}

export interface PurchaseTotals {
  subtotal: Prisma.Decimal; // Σ gross (before any discount)
  discountTotal: Prisma.Decimal; // Σ line discounts + header discount
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal; // amount owed to supplier
  lines: ComputedPurchaseLine[];
}

/** Aggregate purchase-line figures plus an optional post-tax header discount. */
export function purchaseTotals(
  lines: PurchaseLineInput[],
  headerDiscount: Decimalish = 0,
): PurchaseTotals {
  const computed = lines.map(computePurchaseLine);
  const subtotal = computed.reduce((s, l) => s.plus(l.gross), ZERO);
  const lineDiscounts = computed.reduce((s, l) => s.plus(l.discount), ZERO);
  const taxTotal = computed.reduce((s, l) => s.plus(l.tax), ZERO);
  const beforeHeader = computed.reduce((s, l) => s.plus(l.lineTotal), ZERO);

  const header = money(D.max(ZERO, D.min(new D(headerDiscount), beforeHeader)));
  const total = money(beforeHeader.minus(header));
  const discountTotal = money(lineDiscounts.plus(header));

  return { subtotal: money(subtotal), discountTotal, taxTotal: money(taxTotal), total, lines: computed };
}

export interface PaymentSplit {
  paidTotal: Prisma.Decimal;
  balanceDue: Prisma.Decimal; // remaining owed to the supplier
}

/** Reconcile payments against the total. A purchase may be under-paid (balanceDue > 0). */
export function purchasePaymentSplit(total: Decimalish, paymentAmounts: Decimalish[]): PaymentSplit {
  const t = new D(total);
  const paidTotal = money(paymentAmounts.reduce<Prisma.Decimal>((s, a) => s.plus(new D(a)), ZERO));
  const balanceDue = money(D.max(ZERO, t.minus(paidTotal)));
  return { paidTotal, balanceDue };
}

/** Weighted-average cost when receiving stock: (oldCost*oldQty + newCost*newQty)/(oldQty+newQty). */
export function weightedAverageCost(
  currentCost: Decimalish,
  currentQty: Decimalish,
  incomingUnitCost: Decimalish,
  incomingQty: Decimalish,
): Prisma.Decimal {
  const curCost = new D(currentCost);
  const curQty = new D(currentQty);
  const inCost = new D(incomingUnitCost);
  const inQty = new D(incomingQty);

  const totalQty = curQty.plus(inQty);
  if (totalQty.isZero()) return money(ZERO);

  const weighted = curCost.times(curQty).plus(inCost.times(inQty));
  return money(weighted.div(totalQty));
}
