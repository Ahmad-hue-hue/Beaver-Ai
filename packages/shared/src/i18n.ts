/** Supported locales. English and Kiswahili are first-class from day one. */
export const LOCALES = ['en', 'sw'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Payment method identifiers. Labels are translated in the web app; these codes are stored.
 * Businesses can enable a subset in settings; "OTHER" covers configurable extras.
 */
export const PAYMENT_METHODS = {
  CASH: 'CASH',
  MOBILE_MONEY: 'MOBILE_MONEY',
  BANK: 'BANK',
  CARD: 'CARD',
  CREDIT: 'CREDIT',
  OTHER: 'OTHER',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
