/**
 * SaaS subscription plans and feature gating.
 *
 * Single source of truth for the plan catalog, shared by the API (enforcement) and the web
 * (pricing page + billing screen). Plans are manual for now — no payment provider — but the
 * catalog is structured so a billing provider can slot in later.
 *
 * Gating philosophy is customer-friendly: a 14-day trial unlocks every premium feature, and
 * beyond the trial only a small set of clearly-premium items are gated. Soft product-count
 * caps exist but are generous; there are NO hard caps on staff/members (never lock a shop
 * out of its own team).
 */

export const PLAN_KEYS = ['FREE', 'BASIC', 'PRO', 'BUSINESS'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

/** The premium features that map to paid tiers. Everything else is free for all plans. */
export type FeatureKey =
  | 'ai' // AI assistant + autonomous insights
  | 'financialReports' // financial P&L / profit reports
  | 'paidPaymentMethods' // mobile-money / card / bank tender
  | 'branches'; // multiple branches

/** Soft usage limits keyed by plan (see PLANS). No member cap by design. */
export type LimitKey = 'products';

export interface PlanFeatureListing {
  key: FeatureKey;
  /** Short human label for the UI. */
  label: string;
  /** One-line description for the pricing page. */
  description: string;
}

export const FEATURE_LISTINGS: PlanFeatureListing[] = [
  {
    key: 'ai',
    label: 'AI assistant & insights',
    description: 'Claude-backed assistant and autonomous business insights.',
  },
  {
    key: 'financialReports',
    label: 'Financial reports',
    description: 'P&L and profit analytics you can rely on.',
  },
  {
    key: 'paidPaymentMethods',
    label: 'Mobile-money, card & bank',
    description: 'Take digital tender, not just cash and credit.',
  },
  {
    key: 'branches',
    label: 'Multiple branches',
    description: 'Run more than one location from a single account.',
  },
];

export interface Plan {
  key: PlanKey;
  name: string;
  tagline: string;
  priceMonthly: number; // major units; 0 = free
  currency: string; // ISO 4217, e.g. 'TZS'
  features: FeatureKey[];
  /** Generous soft cap on active products. null = unlimited. */
  productLimit: number | null;
  highlighted?: boolean;
}

/**
 * The plan catalog in ascending tier order. FREE is the default for every new business.
 * Monetary prices are informational only while billing is manual.
 */
export const PLANS: readonly Plan[] = [
  {
    key: 'FREE',
    name: 'Free',
    tagline: 'Everything a small duka needs to get going.',
    priceMonthly: 0,
    currency: 'TZS',
    features: [],
    productLimit: 200,
  },
  {
    key: 'BASIC',
    name: 'Basic',
    tagline: 'Add the AI assistant and take digital payments.',
    priceMonthly: 25_000,
    currency: 'TZS',
    features: ['ai', 'paidPaymentMethods'],
    productLimit: 1_000,
  },
  {
    key: 'PRO',
    name: 'Pro',
    tagline: 'Deep financial reports plus the AI copilot.',
    priceMonthly: 60_000,
    currency: 'TZS',
    features: ['ai', 'paidPaymentMethods', 'financialReports'],
    productLimit: 5_000,
    highlighted: true,
  },
  {
    key: 'BUSINESS',
    name: 'Business',
    tagline: 'Multi-branch with no limits.',
    priceMonthly: 150_000,
    currency: 'TZS',
    features: ['ai', 'paidPaymentMethods', 'financialReports', 'branches'],
    productLimit: null,
  },
] as const;

export function planForKey(key: string | null | undefined): Plan {
  return PLANS.find((p) => p.key === key) ?? PLANS[0]!;
}

/** The set of premium features a plan unlocks (excludes the trial bypass). */
export function featuresFor(plan: PlanKey | null | undefined): FeatureKey[] {
  return planForKey(plan).features;
}

/** Soft cap on active products for a plan. null = unlimited. */
export function productLimitFor(plan: PlanKey | null | undefined): number | null {
  return planForKey(plan).productLimit;
}

/**
 * Whether a shop can use a premium feature. An active 14-day trial bypasses the plan gate so
 * new businesses get everything up front (customer-friendly).
 */
export function canUseFeature(
  plan: PlanKey | null | undefined,
  isTrialActive: boolean,
  feature: FeatureKey,
): boolean {
  if (isTrialActive) return true;
  return featuresFor(plan).includes(feature);
}

/** Whether this message brings a business to the paid-method gate (FREE, not on trial). */
export function isPaidPaymentMethodBlocked(
  plan: PlanKey | null | undefined,
  isTrialActive: boolean,
): boolean {
  return !canUseFeature(plan, isTrialActive, 'paidPaymentMethods');
}

/** A 14-day trial is active while trialEndsAt is present and still in the future. */
export function isTrialActive(trialEndsAt: Date | null | undefined, now: Date = new Date()): boolean {
  return !!trialEndsAt && trialEndsAt.getTime() > now.getTime();
}
