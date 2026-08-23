import { describe, expect, it } from 'bun:test';
import { computeLine, paymentSplit, saleTotals } from './totals.js';

describe('sale line math (Decimal)', () => {
  it('lineTotal = unitPrice * qty when no discount/tax', () => {
    const l = computeLine({ unitPrice: 2500, quantity: 10 });
    expect(l.gross.toString()).toBe('25000');
    expect(l.lineTotal.toString()).toBe('25000');
  });

  it('applies a per-line discount before tax', () => {
    const l = computeLine({ unitPrice: 1000, quantity: 3, discount: 500, taxRate: '0.18' });
    expect(l.gross.toString()).toBe('3000');
    expect(l.taxableBase.toString()).toBe('2500');
    expect(l.tax.toString()).toBe('450'); // 2500 * 0.18
    expect(l.lineTotal.toString()).toBe('2950');
  });

  it('clamps a discount larger than the line to the line value (never negative)', () => {
    const l = computeLine({ unitPrice: 1000, quantity: 1, discount: 5000 });
    expect(l.discount.toString()).toBe('1000');
    expect(l.lineTotal.toString()).toBe('0');
  });

  it('supports fractional quantities (e.g. 2.5 kg)', () => {
    const l = computeLine({ unitPrice: 1200, quantity: '2.5' });
    expect(l.lineTotal.toString()).toBe('3000');
  });
});

describe('sale totals (Decimal)', () => {
  it('sums lines into subtotal / tax / total', () => {
    const t = saleTotals([
      { unitPrice: 2500, quantity: 10 },
      { unitPrice: 1000, quantity: 3, taxRate: '0.18' },
    ]);
    expect(t.subtotal.toString()).toBe('28000');
    expect(t.taxTotal.toString()).toBe('540');
    expect(t.total.toString()).toBe('28540');
    expect(t.discountTotal.toString()).toBe('0');
  });

  it('adds line + header discounts into discountTotal and reduces the total', () => {
    const t = saleTotals(
      [{ unitPrice: 1000, quantity: 5, discount: 200 }], // gross 5000, base 4800
      300, // header discount
    );
    expect(t.subtotal.toString()).toBe('5000');
    expect(t.total.toString()).toBe('4500'); // 4800 - 300
    expect(t.discountTotal.toString()).toBe('500'); // 200 line + 300 header
  });

  it('a header discount never pushes the total below zero', () => {
    const t = saleTotals([{ unitPrice: 100, quantity: 1 }], 999);
    expect(t.total.toString()).toBe('0');
    expect(t.discountTotal.toString()).toBe('100');
  });
});

describe('payment split (Decimal)', () => {
  it('cash: change is the surplus over the total', () => {
    const s = paymentSplit(25000, [30000], false);
    expect(s.paidTotal.toString()).toBe('30000');
    expect(s.changeGiven.toString()).toBe('5000');
    expect(s.balanceDue.toString()).toBe('0');
  });

  it('split payment sums multiple tenders', () => {
    const s = paymentSplit(25000, [10000, 15000], false);
    expect(s.paidTotal.toString()).toBe('25000');
    expect(s.changeGiven.toString()).toBe('0');
    expect(s.balanceDue.toString()).toBe('0');
  });

  it('credit: the unpaid remainder becomes the balance due', () => {
    const s = paymentSplit(25000, [10000], true);
    expect(s.paidTotal.toString()).toBe('10000');
    expect(s.balanceDue.toString()).toBe('15000');
    expect(s.changeGiven.toString()).toBe('0');
  });

  it('credit with no upfront payment owes the whole total', () => {
    const s = paymentSplit(25000, [], true);
    expect(s.balanceDue.toString()).toBe('25000');
  });

  it('no float drift (0.1 + 0.2 tenders = 0.3)', () => {
    const s = paymentSplit('0.3', ['0.1', '0.2'], false);
    expect(s.paidTotal.toString()).toBe('0.3');
    expect(s.changeGiven.toString()).toBe('0');
  });
});
