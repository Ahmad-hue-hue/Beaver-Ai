import { describe, expect, it } from 'bun:test';
import { Prisma } from '@prisma/client';
import { grossMargin, isBelowCost, markup, priceForMargin, unitProfit } from './pricing.js';
import { isLowStock, nextBalance, variance, wouldGoNegative } from '../inventory/stock.js';

describe('pricing (Decimal)', () => {
  it('gross margin = (price - cost) / price', () => {
    expect(grossMargin(2000, 2500).toString()).toBe('0.2');
  });

  it('gross margin is 0 when price is 0', () => {
    expect(grossMargin(2000, 0).toString()).toBe('0');
  });

  it('markup = (price - cost) / cost', () => {
    expect(markup(2000, 2500).toString()).toBe('0.25');
  });

  it('unit profit = price - cost', () => {
    expect(unitProfit(2000, 2500).toString()).toBe('500');
  });

  it('priceForMargin: cost 8500 @ 20% → 10625.00', () => {
    expect(priceForMargin(8500, '0.2').toString()).toBe('10625');
  });

  it('priceForMargin clamps margin below 1 (no divide-by-zero)', () => {
    // margin 0.99 → cost / 0.01 = cost * 100
    expect(priceForMargin(10, '1.5').toString()).toBe('1000');
  });

  it('isBelowCost flags a losing price', () => {
    expect(isBelowCost(2000, 1900)).toBe(true);
    expect(isBelowCost(2000, 2000)).toBe(false);
  });

  it('keeps precision decimal.js provides (no float drift)', () => {
    // 0.1 + 0.2 must be exactly 0.3
    expect(new Prisma.Decimal('0.1').plus('0.2').toString()).toBe('0.3');
  });
});

describe('stock (Decimal)', () => {
  it('nextBalance adds signed quantity', () => {
    expect(nextBalance(140, -10).toString()).toBe('130');
    expect(nextBalance('100.5', '49.5').toString()).toBe('150');
  });

  it('variance = counted - expected', () => {
    expect(variance(48, 50).toString()).toBe('-2'); // shrinkage
    expect(variance(52, 50).toString()).toBe('2'); // overage
  });

  it('wouldGoNegative detects overselling', () => {
    expect(wouldGoNegative(5, 10)).toBe(true);
    expect(wouldGoNegative(10, 10)).toBe(false);
  });

  it('isLowStock respects the reorder level (0 level disables)', () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
    expect(isLowStock(0, 0)).toBe(false); // no reorder level set
  });
});
