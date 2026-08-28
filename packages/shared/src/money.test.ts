import { describe, expect, it } from 'bun:test';
import { formatMoney, grossMarginRatio, parseMoney, priceForTargetMargin } from './money.js';

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

describe('formatMoney', () => {
  it('formats with the currency symbol by default', () => {
    expect(formatMoney(2500, { currency: 'TZS' })).toBe('TSh\u00A02,500.00');
  });

  it('honours a custom locale', () => {
    expect(formatMoney(2500.5, { currency: 'USD', locale: 'en-US' })).toBe('$2,500.50');
    expect(formatMoney(2500.5, { currency: 'USD', locale: 'de-DE' })).toBe('2.500,50\u00A0$');
  });

  it('omits the symbol in symbolless mode', () => {
    expect(formatMoney(2500, { currency: 'TZS', symbolless: true })).toBe('2,500');
  });

  it('renders zero and non-finite input safely', () => {
    expect(formatMoney(NaN, { currency: 'TZS' })).toBe('TSh\u00A00.00');
    expect(formatMoney(Infinity, { currency: 'TZS' })).toBe('TSh\u00A00.00');
    expect(formatMoney('garbage', { currency: 'TZS', symbolless: true })).toBe('0');
  });

  it('formats from a decimal string', () => {
    expect(formatMoney('1234567.89', { currency: 'TZS' })).toBe('TSh\u00A01,234,567.89');
  });
});

