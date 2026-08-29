'use client';

import Link from 'next/link';
import { ArrowRight, Check } from '@/components/ui/icon';
import { useAuth } from '@/lib/auth-context';

const RANK: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, BUSINESS: 3 };

/** Action-aware plan CTA. Logged-out users go to /register; logged-in users get a real upgrade path. */
export function PlanCta({
  planKey,
  planName,
  featured,
}: {
  planKey: string;
  planName: string;
  featured?: boolean;
}) {
  const { session } = useAuth();
  const current = session?.plan;
  const isCurrent = !!current && current === planKey;

  // Not signed in (or still restoring the session) → invite to create an account.
  if (!session) {
    return (
      <Link
        href="/register"
        className={`tap mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
          featured ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-hairline text-slate-700 hover:bg-slate-50'
        }`}
      >
        {planKey === 'FREE' ? 'Start free' : `Choose ${planName}`}
        <ArrowRight className="size-4" />
      </Link>
    );
  }

  // Signed in. The pricing page only offers upgrades (never a downgrade).
  if (isCurrent) {
    return (
      <span className="tap mt-8 inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700">
        <Check className="size-4" /> Your current plan
      </span>
    );
  }

  const upgrade = RANK[planKey] > RANK[current ?? 'FREE'];
  return (
    <Link
      href={upgrade ? '/settings/billing' : '/settings/billing'}
      className={`tap mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
        featured ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-hairline text-slate-700 hover:bg-slate-50'
      }`}
    >
      {upgrade ? `Upgrade to ${planName}` : 'View billing'}
      <ArrowRight className="size-4" />
    </Link>
  );
}
