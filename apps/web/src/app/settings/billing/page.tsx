'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import type { Session } from '@/lib/session';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/app-shell';
import { Check, Loader2 } from '@/components/ui/icon';

interface Plan {
  key: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  currency: string;
  features: string[];
  productLimit: number | null;
  highlighted?: boolean;
}

interface BillingState {
  plan: string;
  trialEndsAt: string | null;
  isTrial: boolean;
  trialDays: number;
  limits: { products: number | null };
  usage: { products: number };
}

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BillingPage() {
  return (
    <AppShell>
      <BillingContent />
    </AppShell>
  );
}

function BillingContent() {
  const { t } = useI18n();
  const { session, setSession } = useAuth();
  const token = session?.accessToken;
  const role = session?.role;
  const qc = useQueryClient();

  const plans = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api.get<Plan[]>('/billing/plans'),
    staleTime: Infinity,
  });

  const billing = useQuery({
    queryKey: ['billing', 'current'],
    queryFn: () => api.get<BillingState>('/billing/current', { accessToken: token }),
    enabled: !!token,
  });

  const changePlan = useMutation({
    mutationFn: (plan: string) =>
      api.patch<Session>('/billing/plan', { plan }, { accessToken: token }),
    onSuccess: (s) => {
      // PATCH re-issues the session (new JWT with the new plan + refresh cookie); apply it so
      // plan/pricing/app-shell reflect the change immediately, not after a full reload.
      if (s?.accessToken) setSession(s);
      qc.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  });

  const canManage = role === 'OWNER';

  const currentPlan = billing.data?.plan;
  const isTrial = billing.data?.isTrial;

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('billing.title')}</h1>
        <p className="mt-1 text-slate-500">{t('billing.subtitle')}</p>
      </header>

      {/* Current plan + trial */}
      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('billing.yourPlan')}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
            {currentPlan ?? '…'}
          </span>
          {isTrial ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
              {t('billing.trial', { count: billing.data?.trialDays ?? 14 })}
            </span>
          ) : null}
        </div>

        {/* Usage meter */}
        {billing.data && (
          <div className="mt-5 max-w-xl">
            <UsageRow
              label={t('billing.activeProducts')}
              value={billing.data.usage.products}
              limit={billing.data.limits.products}
            />
          </div>
        )}
      </section>

      {!canManage && (
        <p className="mt-8 rounded-xl border border-hairline bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t('billing.ownerOnly')} Ask your owner to upgrade if you need more features or head to{' '}
          <Link href="/pricing" className="font-medium text-brand-700 hover:text-brand-800">
            the pricing page
          </Link>{' '}
          to compare plans.
        </p>
      )}

      {/* Change plan */}
      {canManage && plans.data && (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('billing.choosePlan')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('billing.manual')} — picking a plan records it; we’ll reach out to arrange payment.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {plans.data.map((plan) => {
              const active = plan.key === currentPlan;
              return (
                <button
                  key={plan.key}
                  type="button"
                  disabled={active || changePlan.isPending}
                  onClick={() => changePlan.mutate(plan.key)}
                  className={cn(
                    'tap flex flex-col rounded-xl border p-5 text-left transition-colors disabled:cursor-default',
                    active
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-hairline hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-semibold tracking-tight text-slate-900">{plan.name}</span>
                    {active && (
                      <span className="flex items-center gap-1 text-sm font-medium text-brand-700">
                        <Check className="size-4" /> {t('billing.current')}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 text-sm text-slate-500">{plan.tagline}</span>
                  <span className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                    {fmt(plan.priceMonthly, plan.currency)}
                    <span className="text-sm font-normal text-slate-400">{t('billing.perMonth')}</span>
                  </span>
                  <ul className="mt-4 flex-1 space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                        <Check className="size-4 shrink-0 text-brand-700" /> {t(featureLabel(f))}
                      </li>
                    ))}
                    {plan.productLimit === null ? (
                      <li className="flex items-center gap-2 text-sm text-slate-700">
                        <Check className="size-4 shrink-0 text-brand-700" /> {t('billing.unlimitedProducts')}
                      </li>
                    ) : (
                      <li className="flex items-center gap-2 text-sm text-slate-400">
                        {t('billing.upToProducts', { count: plan.productLimit })}
                      </li>
                    )}
                  </ul>
                  {!active && (
                    <span className="tap mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800">
                      {changePlan.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {t('billing.choose', { name: plan.name })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {changePlan.isSuccess && (
            <p className="mt-3 text-sm font-medium text-brand-600">
              {t('billing.updated')}
            </p>
          )}
          {changePlan.isError && (
            <p className="mt-3 text-sm font-medium text-red-600">
              {changePlan.error instanceof ApiError
                ? changePlan.error.message
                : t('billing.failed')}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function UsageRow({ label, value, limit }: { label: string; value: number; limit: number | null }) {
  const { t } = useI18n();
  const pct = limit === null || limit === 0 ? 0 : Math.min(100, Math.round((value / limit) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-mono text-slate-500">
          {value}
          {limit !== null ? ` / ${limit}` : ''}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            'h-full rounded-full',
            limit !== null && pct >= 90 ? 'bg-amber-500' : 'bg-brand-600',
          )}
          style={{ width: `${limit === null ? 100 : pct}%` }}
        />
      </div>
      {limit !== null && pct >= 90 && (
        <p className="mt-1 text-xs text-amber-700">
          {t('billing.limitWarning')}
        </p>
      )}
    </div>
  );
}

function featureLabel(key: string): string {
  const map: Record<string, string> = {
    ai: 'billing.feature.ai',
    financialReports: 'billing.feature.reports',
    paidPaymentMethods: 'billing.feature.payments',
    branches: 'billing.feature.branches',
  };
  return map[key] ?? key;
}
