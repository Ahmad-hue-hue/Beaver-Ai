import { describe, expect, it } from 'bun:test';
import { buildTrend, marginPct } from './math.js';

describe('marginPct', () => {
  it('returns 0 when there is no revenue', () => {
    expect(marginPct(0, 0)).toBe(0);
    expect(marginPct('0', '0')).toBe(0);
  });

  it('computes a healthy margin as a whole percentage', () => {
    expect(marginPct(100000, 30000)).toBe(30);
  });

  it('is Decimal-safe (handles fractions without float drift)', () => {
    expect(marginPct('333333', '111111')).toBe(33);
  });

  it('reports a negative margin on a loss', () => {
    expect(marginPct(50000, -5000)).toBe(-10);
  });

  it('rounds half up', () => {
    expect(marginPct(3, 1)).toBe(33);
  });
});

function key(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function today(): string {
  return key(new Date());
}
function shift(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return key(d);
}

describe('buildTrend', () => {
  it('zero-fills gaps to keep a continuous daily series', () => {
    const rows = buildTrend(3, new Date(), [
      { date: shift(-2), revenue: '1000', cogs: '400' },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ date: shift(-2), revenue: '1000', cogs: '400', profit: '600' });
    expect(rows[1]).toEqual({ date: shift(-1), revenue: '0', cogs: '0', profit: '0' });
    expect(rows[2]).toEqual({ date: today(), revenue: '0', cogs: '0', profit: '0' });
  });

  it('aggregates multiple sources on the same day', () => {
    const rows = buildTrend(1, new Date(), [
      { date: today(), revenue: '300', cogs: '100' },
      { date: today(), revenue: '200', cogs: '50' },
    ]);
    expect(rows[0]).toEqual({ date: today(), revenue: '500', cogs: '150', profit: '350' });
  });

  it('keeps money as Decimal-formatted strings (no float drift)', () => {
    const rows = buildTrend(1, new Date(), [{ date: today(), revenue: '0.1', cogs: '0.2' }]);
    expect(rows[0]!.revenue).toBe('0.1');
    expect(rows[0]!.profit).toBe('-0.1');
  });
});
