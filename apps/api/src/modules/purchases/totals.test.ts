import { describe, expect, it } from 'bun:test';
import { Prisma } from '@prisma/client';
import {
  computePurchaseLine,
  purchaseTotals,
  purchasePaymentSplit,
  weightedAverageCost,
} from './totals.js';

const D = Prisma.Decimal;

describe('computePurchaseLine', () => {
  it('computes gross, discount, tax and line total', () => {
    const l = computePurchaseLine({ unitCost: 100, quantity: 3, taxRate: 0.2 });
    expect(l.gross.toString()).toBe('300');
    expect(l.lineTotal.toString()).toBe('360');
  });

  it('applies a per-line discount before tax', () => {
    const l = computePurchaseLine({ unitCost: 100, quantity: 3, discount: 30, taxRate: 0.1 });
    expect(l.discount.toString()).toBe('30');
    expect(l.taxableBase.toString()).toBe('270');
    expect(l.tax.toString()).toBe('27');
    expect(l.lineTotal.toString()).toBe('297');
  });

  it('clamps discount to the gross', () => {
    const l = computePurchaseLine({ unitCost: 10, quantity: 2, discount: 999 });
    expect(l.discount.toString()).toBe('20');
    expect(l.lineTotal.toString()).toBe('0');
  });

  it('handles fractional quantity', () => {
    const l = computePurchaseLine({ unitCost: 5000, quantity: 2.5 });
    expect(l.gross.toString()).toBe('12500');
  });
});

describe('purchaseTotals', () => {
  it('sums subtotal, tax and total', () => {
    const t = purchaseTotals([
      { unitCost: 100, quantity: 2, taxRate: 0.1 },
      { unitCost: 50, quantity: 4, taxRate: 0.1 },
    ]);
    expect(t.subtotal.toString()).toBe('400');
    expect(t.taxTotal.toString()).toBe('40');
    expect(t.total.toString()).toBe('440');
  });

  it('applies a post-tax header discount, never below zero', () => {
    const t = purchaseTotals([{ unitCost: 100, quantity: 1, taxRate: 0.1 }], 500);
    expect(t.total.toString()).toBe('0');
    expect(t.discountTotal.toString()).toBe('110');
  });
});

describe('purchasePaymentSplit', () => {
  it('returns balanceDue when under-paid', () => {
    const s = purchasePaymentSplit('440.00', ['200.00']);
    expect(s.paidTotal.toString()).toBe('200');
    expect(s.balanceDue.toString()).toBe('240');
  });

  it('returns zero balance when fully paid', () => {
    const s = purchasePaymentSplit('440.00', ['440.00']);
    expect(s.balanceDue.toString()).toBe('0');
  });
});

describe('weightedAverageCost', () => {
  it('blends current and incoming costs by quantity', () => {
    // 10 units at 100, receiving 10 units at 80 → (1000+800)/20 = 90
    const c = weightedAverageCost(100, 10, 80, 10);
    expect(c.toString()).toBe('90');
  });

  it('uses the incoming cost when there is no existing stock', () => {
    const c = weightedAverageCost(0, 0, 80, 10);
    expect(c.toString()).toBe('80');
  });

  it('keeps current cost when zero new qty', () => {
    const c = weightedAverageCost(100, 10, 80, 0);
    expect(c.toString()).toBe('100');
  });

  it('rounds to 2dp half-up', () => {
    const c = weightedAverageCost(100, 3, 0, 1); // (300)/4 = 75
    expect(c.toString()).toBe('75');
  });

  it('is Decimal-backed (no float drift)', () => {
    const c = weightedAverageCost(new D(100), new D(3), new D(80), new D(9)); // (300+720)/12
    expect(c.toString()).toBe('85');
  });
});
