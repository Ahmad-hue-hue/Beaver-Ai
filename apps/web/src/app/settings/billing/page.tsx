'use client';

import * as React from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import type { ServiceStatus } from '@/lib/session';
import { Check, RefreshCw, Shield, TriangleAlert } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

function fmtDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' })
    : '—';
}

/** Per-account monthly subscription (flat rate, arranged directly with the admin). */
export default function SubscriptionPage() {
  return (
    <AppShell>
      <SubscriptionContent />
    </AppShell>
  );
}

function SubscriptionContent() {
  const { t } = useI18n();
  const { session } = useAuth();
  const status: ServiceStatus = session?.serviceStatus ?? 'PENDING';

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('billing.title')}</h1>
        <p className="mt-1 text-slate-500">{t('billing.subtitle')}</p>
      </header>

      {/* Current status */}
      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('billing.status')}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusBadge status={status} t={t} />
          <span className="text-sm text-slate-500">
            {t('billing.monthlyFee')} 50,000 TZS
          </span>
        </div>

        <dl className="mt-6 max-w-xl space-y-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-3">
            <dt className="text-sm text-slate-500">{t('billing.expires')}</dt>
            <dd className="font-mono text-sm font-medium tabular-nums text-slate-800">
              {fmtDate(session?.serviceExpiresAt ?? null)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-3">
            <dt className="text-sm text-slate-500">{t('billing.accountEmail')}</dt>
            <dd className="truncate font-mono text-sm text-slate-800">{session?.user.email}</dd>
          </div>
        </dl>
      </section>

      {(status === 'PENDING' || status === 'EXPIRED') && (
        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-800">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" />
            {status === 'PENDING' ? t('billing.pendingTitle') : t('billing.expiredTitle')}
          </p>
          <p className="mt-2">{status === 'PENDING' ? t('billing.pendingBody') : t('billing.expiredBody')}</p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('billing.renewTitle')}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={cn(
            'flex items-center gap-2 rounded-full bg-slate-100 px-3.5 py-1.5 text-sm text-slate-700',
          )}>
            <RefreshCw className="size-4" />
            {t('billing.renewNote')}
          </span>
          <span className="flex items-center gap-2 rounded-full bg-slate-100 px-3.5 py-1.5 text-sm text-slate-700">
            <Shield className="size-4" />
            {t('billing.contactAdmin')}
          </span>
        </div>
        <ul className="mt-5 max-w-xl space-y-2.5 text-sm text-slate-600">
          {['cost', 'renew', 'features'].map((k) => (
            <li key={k} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-700" />
              {t(`billing.facts.${k}`)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatusBadge({ status, t }: { status: ServiceStatus; t: (key: string) => string }) {
  const cls =
    status === 'ACTIVE'
      ? 'border-brand-200 bg-brand-50 text-brand-700'
      : status === 'PENDING'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-red-200 bg-red-50 text-red-700';
  return (
    <span className={cn('rounded-full border px-3 py-1 text-sm font-semibold', cls)}>
      {t(`billing.status.${status.toLowerCase()}`)}
    </span>
  );
}