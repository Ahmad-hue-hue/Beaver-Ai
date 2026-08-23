/**
 * Money helpers shared by API and web.
 *
 * IMPORTANT: financial arithmetic on the backend uses Prisma `Decimal` (decimal.js) and
 * never JS floats. These helpers are for formatting and safe parsing only — do not use
 * `number` math for money in business logic.
 */

export type CurrencyCode = string; // ISO 4217, e.g. 'TZS', 'USD', 'KES'

export interface MoneyFormatOptions {
  currency: CurrencyCode;
  locale?: string; // BCP-47, e.g. 'en-TZ', 'sw-TZ'
  /** When true, omit the currency symbol (e.g. table cells that show the code elsewhere). */
  symbolless?: boolean;
}

/**
 * Format a monetary amount. Accepts a number, a decimal string, or bigint minor units is
 * NOT assumed — pass major-unit values (e.g. 2500 for TZS 2,500). Uses the currency's own
 * fraction-digit convention (TZS → 0, USD → 2). Tabular grouping is applied by the UI font.
 */
export function formatMoney(
  amount: number | string,
  { currency, locale = 'en-TZ', symbolless = false }: MoneyFormatOptions,
): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(value) ? value : 0;
  const formatter = new Intl.NumberFormat(locale, {
    style: symbolless ? 'decimal' : 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  });
  return formatter.format(safe);
}

/**
 * Parse a user-entered money string into a plain number, tolerating mixed grouping/decimal
 * conventions ("2,500" → 2500, "2 500.50" → 2500.5, "1.234.567,89" → 1234567.89).
 */
export function parseMoney(input: string): number {
  const cleaned = input.replace(/[^0-9.,-]/g, '').replace(/\s/g, '');
  if (!cleaned) return 0;

  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');

  const normalized = ((): string => {
    if (hasDot && hasComma) {
      // The separator that appears last is the decimal point; the other is grouping.
      const decimalSep = cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',') ? '.' : ',';
      const groupSep = decimalSep === '.' ? ',' : '.';
      return cleaned.split(groupSep).join('').replace(decimalSep, '.');
    }
    const sep = hasDot ? '.' : hasComma ? ',' : '';
    if (!sep) return cleaned;
    const parts = cleaned.split(sep);
    // Multiple separators → all grouping (e.g. "1.234.567"). A single separator followed
    // by exactly 3 digits is ambiguous; treat it as grouping ("2,500" → 2500).
    const lastPart = parts[parts.length - 1] ?? '';
    const isGrouping = parts.length > 2 || (parts.length === 2 && lastPart.length === 3);
    return isGrouping ? parts.join('') : parts.join('.');
  })();

  return Number(normalized) || 0;
}

/** Gross margin fraction (0..1) from cost & selling price. Returns 0 when price is 0. */
export function grossMarginRatio(cost: number, price: number): number {
  if (!price) return 0;
  return (price - cost) / price;
}

/** Suggested selling price for a target margin (0..1). e.g. cost 8500, margin 0.2 → 10625. */
export function priceForTargetMargin(cost: number, targetMargin: number): number {
  const m = Math.min(Math.max(targetMargin, 0), 0.99);
  return cost / (1 - m);
}
