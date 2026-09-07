import { describe, expect, test } from 'bun:test';
import {
  SERVICE_MONTH_MS,
  reverseSubscriptionExtension,
  subscriptionPeriodFor,
} from './subscription-period.js';

describe('subscriptionPeriodFor', () => {
  const now = new Date('2026-09-03T10:00:00.000Z');

  test('first payment starts now and grants one 30-day window', () => {
    const p = subscriptionPeriodFor(null, now, 1);
    expect(p.periodStart).toEqual(now);
    expect(p.periodEnd.getTime() - p.periodStart.getTime()).toBe(SERVICE_MONTH_MS);
  });

  test('expired subscription restarts at now (never in the past)', () => {
    const expired = new Date(now.getTime() - 5 * SERVICE_MONTH_MS);
    const p = subscriptionPeriodFor(expired, now, 1);
    expect(p.periodStart).toEqual(now);
  });

  test('active subscription extends from its expiry (never shortened)', () => {
    const active = new Date(now.getTime() + 10 * SERVICE_MONTH_MS);
    const p = subscriptionPeriodFor(active, now, 2);
    expect(p.periodStart).toEqual(active);
    expect(p.periodEnd.getTime() - active.getTime()).toBe(2 * SERVICE_MONTH_MS);
  });

  test('rejects non-positive or fractional months', () => {
    expect(() => subscriptionPeriodFor(null, now, 0)).toThrow();
    expect(() => subscriptionPeriodFor(null, now, -1)).toThrow();
    expect(() => subscriptionPeriodFor(null, now, 1.5)).toThrow();
  });
});

describe('reverseSubscriptionExtension', () => {
  const now = new Date('2026-09-03T10:00:00.000Z');

  test('moves expiry back by the voided months', () => {
    const periodStart = now;
    const current = new Date(now.getTime() + 2 * SERVICE_MONTH_MS);
    const reversed = reverseSubscriptionExtension(current, periodStart, 1);
    expect(reversed?.getTime()).toBe(now.getTime() + SERVICE_MONTH_MS);
  });

  test('never moves expiry before the payment period start', () => {
    const periodStart = now;
    const current = new Date(now.getTime() + SERVICE_MONTH_MS);
    const reversed = reverseSubscriptionExtension(current, periodStart, 3);
    expect(reversed).toEqual(periodStart);
  });

  test('null expiry stays null', () => {
    expect(reverseSubscriptionExtension(null, now, 1)).toBeNull();
  });
});
