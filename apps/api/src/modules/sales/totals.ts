import { Prisma } from '@prisma/client';

/**
 * Deterministic Decimal money math for a sale. All figures are `Prisma.Decimal` (never JS
 * floats) and money is rounded to 2 dp half-up. A line's taxable base is its gross less any
 * per-line discount; a header discount is applied after tax as a flat reduction of the total
 * (it never pushes the total below zero).
 */

const D = Prisma.Decimal;
export type Decimalish = Prisma.Decimal | string | number;

const ZERO = new D(0);
const money = (v: Prisma.Decimal): Prisma.Decimal => v.toDecimalPlaces(2, D.ROUND_HALF_UP);

export interface SaleLineInput {
  unitPrice: Decimalish;
  quantity: Decimalish;
  discount?: Decimalish; // per-line discount amount (absolute), default 0
  taxRate?: Decimalish; // fraction 0..1, default 0
}

export interface ComputedLine {
  gross: Prisma.Decimal; // unitPrice * quantity
  discount: Prisma.Decimal; // clamped to [0, gross]
  taxableBase: Prisma.Decimal; // gross - discount
  tax: Prisma.Decimal;
  lineTotal: Prisma.Decimal; // taxableBase + tax
}

/** Compute one line's money figures. */
export function computeLine(line: SaleLineInput): ComputedLine {
  const gross = money(new D(line.unitPrice).times(new D(line.quantity)));
  const rawDiscount = line.discount != null ? new D(line.discount) : ZERO;
  const discount = money(D.max(ZERO, D.min(rawDiscount, gross)));
  const taxableBase = gross.minus(discount);
  const tax = money(taxableBase.times(line.taxRate != null ? new D(line.taxRate) : ZERO));
  const lineTotal = taxableBase.plus(tax);
  return { gross, discount, taxableBase, tax, lineTotal };
}

export interface SaleTotals {
  subtotal: Prisma.Decimal; // Σ gross (before any discount)
  discountTotal: Prisma.Decimal; // Σ line discounts + header discount
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal; // amount payable
  lines: ComputedLine[];
}

/** Aggregate line figures plus an optional post-tax header discount into sale totals. */
export function saleTotals(lines: SaleLineInput[], headerDiscount: Decimalish = 0): SaleTotals {
  const computed = lines.map(computeLine);
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
  changeGiven: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
}

/**
 * Reconcile payments against the total. Credit sales may be under-paid (the remainder becomes
 * `balanceDue`, owed by the customer); non-credit sales must cover the total and any surplus is
 * returned as `changeGiven`.
 */
export function paymentSplit(
  total: Decimalish,
  paymentAmounts: Decimalish[],
  isCredit: boolean,
): PaymentSplit {
  const t = new D(total);
  const paidTotal = money(paymentAmounts.reduce<Prisma.Decimal>((s, a) => s.plus(new D(a)), ZERO));

  if (isCredit) {
    const balanceDue = money(D.max(ZERO, t.minus(paidTotal)));
    const changeGiven = money(D.max(ZERO, paidTotal.minus(t)));
    return { paidTotal, changeGiven, balanceDue };
  }
  const changeGiven = money(D.max(ZERO, paidTotal.minus(t)));
  return { paidTotal, changeGiven, balanceDue: ZERO };
}
