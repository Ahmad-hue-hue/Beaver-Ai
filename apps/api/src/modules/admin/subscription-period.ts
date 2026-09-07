/**
 * Platform subscription period math (pure, unit-tested).
 *
 * A paid month is a fixed 30-day window. Extensions never shorten an active
 * subscription: the new period starts at `max(now, currentExpiry)`.
 * Voiding a payment reverses exactly that payment's extension (LIFO discipline
 * is enforced by the service — see AdminService.voidPayment).
 */

export const SERVICE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export interface SubscriptionPeriod {
  periodStart: Date;
  periodEnd: Date;
}

/** Compute the [start, end) window a payment of `months` buys on top of `currentExpiry`. */
export function subscriptionPeriodFor(
  currentExpiry: Date | null,
  now: Date,
  months: number,
): SubscriptionPeriod {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error('months must be a positive integer.');
  }
  const base =
    currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return {
    periodStart: new Date(base.getTime()),
    periodEnd: new Date(base.getTime() + months * SERVICE_MONTH_MS),
  };
}

/**
 * Reverse one payment's extension (void path). The expiry moves back by
 * `months` windows but never before the payment's own `periodStart` — a void
 * only ever undoes what its payment granted.
 */
export function reverseSubscriptionExtension(
  currentExpiry: Date | null,
  periodStart: Date,
  months: number,
): Date | null {
  if (!currentExpiry) return null;
  const reversed = new Date(currentExpiry.getTime() - months * SERVICE_MONTH_MS);
  return reversed.getTime() < periodStart.getTime() ? new Date(periodStart.getTime()) : reversed;
}
