import { describe, expect, it } from 'bun:test';
import {
  canUseFeature,
  featuresFor,
  isPaidPaymentMethodBlocked,
  isTrialActive,
  PLANS,
  planForKey,
  productLimitFor,
} from './plans.js';

describe('plan catalog', () => {
  it('exposes four tiers in ascending order', () => {
    expect(PLANS.map((p) => p.key)).toEqual(['FREE', 'BASIC', 'PRO', 'BUSINESS']);
  });

  it('is ordered free → paid', () => {
    const prices = PLANS.map((p) => p.priceMonthly);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('resolves unknown keys to FREE', () => {
    expect(planForKey(null).key).toBe('FREE');
    expect(planForKey('NONSENSE')).toBe(PLANS[0]);
  });
});

describe('featuresFor', () => {
  it('gates the four premium features progressively', () => {
    expect(featuresFor('FREE')).toEqual([]);
    expect(featuresFor('BASIC')).toEqual(['ai', 'paidPaymentMethods']);
    expect(featuresFor('PRO')).toEqual(['ai', 'paidPaymentMethods', 'financialReports']);
    expect(featuresFor('BUSINESS')).toEqual([
      'ai',
      'paidPaymentMethods',
      'financialReports',
      'branches',
    ]);
  });
});

describe('productLimitFor', () => {
  it('raises the soft cap per tier, unlimited at BUSINESS', () => {
    expect(productLimitFor('FREE')).toBe(200);
    expect(productLimitFor('BASIC')).toBe(1000);
    expect(productLimitFor('PRO')).toBe(5000);
    expect(productLimitFor('BUSINESS')).toBeNull();
  });
});

describe('canUseFeature + trial bypass', () => {
  it('denies premium features on FREE without a trial', () => {
    expect(canUseFeature('FREE', false, 'ai')).toBe(false);
    expect(canUseFeature('FREE', false, 'financialReports')).toBe(false);
    expect(canUseFeature('FREE', false, 'paidPaymentMethods')).toBe(false);
    expect(canUseFeature('FREE', false, 'branches')).toBe(false);
  });

  it('unlocks tiered features on their plan', () => {
    expect(canUseFeature('BASIC', false, 'ai')).toBe(true);
    expect(canUseFeature('BASIC', false, 'paidPaymentMethods')).toBe(true);
    expect(canUseFeature('BASIC', false, 'financialReports')).toBe(false);
    expect(canUseFeature('PRO', false, 'financialReports')).toBe(true);
    expect(canUseFeature('PRO', false, 'branches')).toBe(false);
    expect(canUseFeature('BUSINESS', false, 'branches')).toBe(true);
  });

  it('an active trial unlocks everything regardless of plan', () => {
    expect(canUseFeature('FREE', true, 'ai')).toBe(true);
    expect(canUseFeature('FREE', true, 'branches')).toBe(true);
    expect(canUseFeature('FREE', true, 'paidPaymentMethods')).toBe(true);
  });
});

describe('isPaidPaymentMethodBlocked', () => {
  it('blocks paid methods on FREE only when not on trial', () => {
    expect(isPaidPaymentMethodBlocked('FREE', false)).toBe(true);
    expect(isPaidPaymentMethodBlocked('FREE', true)).toBe(false);
    expect(isPaidPaymentMethodBlocked('BASIC', false)).toBe(false);
    expect(isPaidPaymentMethodBlocked('PRO', false)).toBe(false);
  });
});

describe('isTrialActive', () => {
  const now = new Date('2026-08-29T00:00:00Z');
  it('is active while the end date is in the future', () => {
    expect(isTrialActive(new Date('2026-09-01T00:00:00Z'), now)).toBe(true);
  });
  it('is not active after expiry or when never set', () => {
    expect(isTrialActive(new Date('2026-08-28T00:00:00Z'), now)).toBe(false);
    expect(isTrialActive(null, now)).toBe(false);
    expect(isTrialActive(undefined, now)).toBe(false);
  });
});
