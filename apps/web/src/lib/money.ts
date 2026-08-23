/**
 * Money formatting for the web. Mirrors @beaver/shared's formatMoney but lives locally to
 * avoid Turbopack's `.js`-specifier resolution friction with the shared TS barrel. Display
 * only — all money arithmetic happens on the API in Decimal.
 */
export function formatMoney(
  amount: number | string,
  { currency = 'TZS', locale = 'en-TZ', symbolless = false }: { currency?: string; locale?: string; symbolless?: boolean } = {},
): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, {
    style: symbolless ? 'decimal' : 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(safe);
}
