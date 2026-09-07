import { describe, expect, it } from 'bun:test';
import { EN, SW, translate, type Locale } from './i18n';

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
}

describe('i18n language parity', () => {
  it('every EN key exists in SW and vice versa', () => {
    const enKeys = Object.keys(EN).sort();
    const swKeys = Object.keys(SW).sort();
    expect(enKeys).toEqual(swKeys);
  });

  it('no translation key falls back to the raw key', () => {
    for (const locale of ['en', 'sw'] as Locale[]) {
      for (const key of Object.keys(EN)) {
        const value = translate(locale, key);
        expect(value, `${locale}: ${key}`).not.toBe(key);
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('placeholder names match between EN and SW for every key', () => {
    for (const key of Object.keys(EN)) {
      expect(placeholders(SW[key]!), `${key} (sw)`).toEqual(placeholders(EN[key]!));
    }
  });

  it('persisted params are substituted into the translated string', () => {
    expect(translate('sw', 'nav.dashboard')).toBe(SW['nav.dashboard']);
    expect(translate('en', 'app.openMenu')).toBe('Open menu');
  });
});