'use client';

import Link from 'next/link';
import { ArrowRight, Settings } from '@/components/ui/icon';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';

/** Top-right header actions for the marketing /pricing page. Logged-out users get
    sign-in + get-started; logged-in users get a direct path into their current plan. */
export function PricingActions() {
  const { session } = useAuth();
  const { t } = useI18n();
  if (!session) {
    return (
      <>
        <Link
          href="/login"
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          {t('plans.signIn')}
        </Link>
        <Link
          href="/register"
          className="whitespace-nowrap rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:px-4"
        >
          {t('plans.getStarted')}
        </Link>
      </>
    );
  }
  return (
    <>
      <Link
        href="/dashboard"
        className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:inline-flex"
      >
        {t('plans.dashboard')}
      </Link>
      <Link
        href="/settings/billing"
        className="whitespace-nowrap inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:px-4"
      >
        <Settings className="size-4" /> {t('plans.managePlan')}
      </Link>
    </>
  );
}

/** Bottom trial-pitch CTA. Logged-out → register to start the trial; logged-in → manage plan. */
export function TrialCta() {
  const { session } = useAuth();
  const { t } = useI18n();
  const href = session ? '/settings/billing' : '/register';
  const label = session ? t('plans.manageYourPlan') : t('plans.startTrial');
  return (
    <Link
      href={href}
      className="tap inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 text-base font-medium text-white transition-colors hover:bg-brand-700"
    >
      {label} <ArrowRight className="size-5" />
    </Link>
  );
}
