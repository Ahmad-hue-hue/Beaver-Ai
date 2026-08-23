import { describe, expect, it } from 'bun:test';
import { grossMarginRatio, parseMoney, priceForTargetMargin } from './money.js';

describe('money helpers', () => {
  it('parses grouped money strings', () => {
    expect(parseMoney('TZS 2,500')).toBe(2500);
    expect(parseMoney('2 500.50')).toBe(2500.5);
    expect(parseMoney('1.234.567,89')).toBe(1234567.89);
  });

  it('computes gross margin ratio', () => {
    expect(grossMarginRatio(2000, 2500)).toBeCloseTo(0.2, 5);
    expect(grossMarginRatio(10, 0)).toBe(0);
  });

  it('computes price for a target margin', () => {
    expect(priceForTargetMargin(8500, 0.2)).toBeCloseTo(10625, 5);
  });
});
