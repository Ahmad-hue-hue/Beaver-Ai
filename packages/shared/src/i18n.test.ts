import { describe, expect, it } from 'bun:test';
import { DEFAULT_LOCALE, LOCALES, PAYMENT_METHODS, isLocale } from './i18n.js';

describe('i18n locales', () => {
  it('exposes a default locale', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });

  it('recognises supported locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('sw')).toBe(true);
  });

  it('rejects unsupported/unknown locales', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('EN')).toBe(false);
    expect(isLocale('')).toBe(false);
  });

  it('maintains a closed set of payment method codes', () => {
    expect(PAYMENT_METHODS.CASH).toBe('CASH');
    expect(PAYMENT_METHODS.MOBILE_MONEY).toBe('MOBILE_MONEY');
    expect(PAYMENT_METHODS.BANK).toBe('BANK');
    expect(PAYMENT_METHODS.CARD).toBe('CARD');
    expect(PAYMENT_METHODS.CREDIT).toBe('CREDIT');
    expect(PAYMENT_METHODS.OTHER).toBe('OTHER');
  });
});
