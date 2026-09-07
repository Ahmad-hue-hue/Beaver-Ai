import { describe, expect, it } from 'bun:test';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats a number as whole shillings with grouping', () => {
    const out = formatMoney(2500);
    expect(out).toContain('2,500');
  });

  it('formats a string amount the same as a number', () => {
    expect(formatMoney('2500')).toBe(formatMoney(2500));
  });

  it('renders symbolless as a plain decimal', () => {
    expect(formatMoney(2500, { symbolless: true })).toBe('2,500');
  });

  it('coerces NaN and Infinity to zero instead of crashing', () => {
    expect(formatMoney('not-a-number')).toBe(formatMoney(0));
    expect(formatMoney(Infinity)).toBe(formatMoney(0));
  });

  it('rounds fractional inputs to whole shillings', () => {
    expect(formatMoney(1.9)).toBe(formatMoney(2));
    expect(formatMoney(99.1)).toBe(formatMoney(99));
  });

  it('displays the currency symbol on the formatted value', () => {
    const out = formatMoney(2500);
    const label = new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }).formatToParts(2500);
    const symbolPart = label.find((p) => p.type === 'currency')?.value ?? '';
    expect(symbolPart.length).toBeGreaterThan(0);
    expect(out).toContain(symbolPart);
  });
});