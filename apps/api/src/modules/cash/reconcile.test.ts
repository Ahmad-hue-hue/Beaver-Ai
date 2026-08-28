import { describe, expect, it } from 'bun:test';
import { reconcile } from './reconcile.js';

describe('reconcile', () => {
  it('balances when expected equals counted', () => {
    const r = reconcile(100000, [50000, -20000], 130000);
    expect(r.expectedCash.toString()).toBe('130000');
    expect(r.variance.toString()).toBe('0');
  });

  it('reports a shortage (counted < expected)', () => {
    const r = reconcile(100000, [50000], 140000); // expected 150000, counted 140000
    expect(r.expectedCash.toString()).toBe('150000');
    expect(r.variance.toString()).toBe('-10000');
  });

  it('reports a surplus (counted > expected)', () => {
    const r = reconcile(100000, [50000], 160000);
    expect(r.expectedCash.toString()).toBe('150000');
    expect(r.variance.toString()).toBe('10000');
  });

  it('handles empty movements: expected equals the float', () => {
    const r = reconcile(50000, [], 50000);
    expect(r.expectedCash.toString()).toBe('50000');
    expect(r.variance.toString()).toBe('0');
  });

  it('is Decimal-backed (no float drift)', () => {
    const r = reconcile('0.3', ['0.1', '0.2'], '0.6');
    expect(r.expectedCash.toString()).toBe('0.6');
    expect(r.variance.toString()).toBe('0');
  });
});
