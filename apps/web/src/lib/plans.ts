/**
 * Plan / feature-gating helpers for the web. Mirrors @beaver/shared's plans but lives locally
 * to avoid Turbopack's `.js`-specifier barrel friction (same rationale as lib/money.ts).
 * The API is the enforcement source of truth; these only drive the UI (show/hide, prompts).
 */

export type FeatureKey =
  | 'ai'
  | 'financialReports'
  | 'paidPaymentMethods'
  | 'branches';

const PLAN_FEATURES: Record<string, FeatureKey[]> = {
  FREE: [],
  BASIC: ['ai', 'paidPaymentMethods'],
  PRO: ['ai', 'paidPaymentMethods', 'financialReports'],
  BUSINESS: ['ai', 'paidPaymentMethods', 'financialReports', 'branches'],
};

export function planFeatures(plan: string | null | undefined): FeatureKey[] {
  return PLAN_FEATURES[plan ?? 'FREE'] ?? [];
}

/** Whether a business can use a premium feature, accounting for the 14-day trial bypass. */
export function canUseFeature(
  plan: string | null | undefined,
  isTrial: boolean,
  feature: FeatureKey,
): boolean {
  if (isTrial) return true;
  return planFeatures(plan).includes(feature);
}

/** Feature labels for prompts/upsells. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  ai: 'The AI assistant',
  financialReports: 'Financial reports',
  paidPaymentMethods: 'Digital payments',
  branches: 'Multiple branches',
};

export function upgradePrompt(plan: string | null | undefined, isTrial: boolean, feature: FeatureKey): string {
  return canUseFeature(plan, isTrial, feature)
    ? ''
    : `${FEATURE_LABELS[feature]} are part of a paid plan. Upgrade in Billing to unlock it.`;
}
