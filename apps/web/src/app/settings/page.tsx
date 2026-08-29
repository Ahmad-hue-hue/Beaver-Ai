'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Coins, Loader2, Shield, UserPlus } from '@/components/ui/icon';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface Business {
  id: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  settings: {
    defaultPaymentMethods: string[];
    defaultLocale: string;
    timezone: string;
    receiptFooter: string | null;
    allowNegativeStock: boolean;
  } | null;
}

interface UpdateSettings {
  defaultPaymentMethods?: string[];
  defaultLocale?: string;
  timezone?: string;
  receiptFooter?: string;
  allowNegativeStock?: boolean;
}

const METHODS = ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CREDIT'];

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}

function SettingsContent() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();

  const biz = useQuery({
    queryKey: ['business'],
    queryFn: () => api.get<Business>('/businesses/current', { accessToken: token }),
    enabled: !!token,
  });

  const [paymentMethods, setPaymentMethods] = React.useState<string[]>([]);
  const [locale, setLocale] = React.useState('en');
  const [timezone, setTimezone] = React.useState('Africa/Dar_es_Salaam');
  const [footer, setFooter] = React.useState('');
  const [allowNegative, setAllowNegative] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (biz.data?.settings && !ready) {
      setPaymentMethods(biz.data.settings.defaultPaymentMethods);
      setLocale(biz.data.settings.defaultLocale);
      setTimezone(biz.data.settings.timezone);
      setFooter(biz.data.settings.receiptFooter ?? '');
      setAllowNegative(biz.data.settings.allowNegativeStock);
      setReady(true);
    }
  }, [biz.data, ready]);

  const save = useMutation({
    mutationFn: (payload: UpdateSettings) =>
      api.patch('/businesses/current/settings', payload, { accessToken: token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business'] }),
  });

  const toggleMethod = (m: string) =>
    setPaymentMethods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );

  const canEdit = session?.role === 'OWNER';

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-500">Shop profile, defaults and team access.</p>
      </header>

      <div className="mt-8 grid gap-10">
        {/* Profile */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Shop</h2>
          <div className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Name" value={biz.data?.name} />
            <Row label="Type" value={biz.data?.type} />
            <Row label="Country" value={biz.data?.country} />
            <Row label="Currency" value={biz.data?.currency} />
            <Row label="Phone" value={biz.data?.phone ?? '—'} />
            <Row label="Tax ID" value={biz.data?.taxId ?? '—'} />
          </div>
        </section>

        {/* Defaults / settings */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Defaults</h2>
          {!biz.data?.settings ? (
            <p className="mt-3 text-sm text-slate-400">Loading settings…</p>
          ) : (
            <div className="mt-3 max-w-xl space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">
                  Default payment methods
                </legend>
                <div className="flex flex-wrap gap-2">
                  {METHODS.map((m) => {
                    const on = paymentMethods.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => toggleMethod(m)}
                        className={cn(
                          'tap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed',
                          on
                            ? 'border-brand-700 bg-brand-50 text-brand-700'
                            : 'border-hairline text-slate-500 hover:bg-slate-50',
                        )}
                      >
                        {m.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Default language</span>
                <select
                  value={locale}
                  disabled={!canEdit}
                  onChange={(e) => setLocale(e.target.value)}
                  className="tap mt-1 h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-brand-400 disabled:opacity-50"
                >
                  <option value="en">English</option>
                  <option value="sw">Kiswahili</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Timezone</span>
                <input
                  value={timezone}
                  disabled={!canEdit}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="tap mt-1 h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-brand-400 disabled:opacity-50"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Receipt footer</span>
                <textarea
                  value={footer}
                  disabled={!canEdit}
                  onChange={(e) => setFooter(e.target.value)}
                  rows={2}
                  className="tap mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-slate-700">Allow negative stock</span>
                <input
                  type="checkbox"
                  checked={allowNegative}
                  disabled={!canEdit}
                  onChange={(e) => setAllowNegative(e.target.checked)}
                  className="size-4 accent-brand-700"
                />
              </label>

              {canEdit && (
                <button
                  onClick={() =>
                    save.mutate({
                      defaultPaymentMethods: paymentMethods,
                      defaultLocale: locale,
                      timezone,
                      receiptFooter: footer,
                      allowNegativeStock: allowNegative,
                    })
                  }
                  disabled={save.isPending}
                  className="tap inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
                >
                  {save.isPending && <Loader2 className="size-4 animate-spin" />}
                  {save.isError ? 'Try again' : 'Save changes'}
                </button>
              )}
              {save.isSuccess && (
                <p className="text-sm font-medium text-brand-600">Saved.</p>
              )}
              {save.isError && (
                <p className="text-sm font-medium text-red-600">
                  {save.error instanceof ApiError ? save.error.message : 'Failed to save.'}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Management */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Management</h2>
          <div className="mt-3 divide-y divide-hairline">
            <LinkRow href="/team" icon={<UserPlus className="size-5" />}>
              <p className="font-medium text-slate-800">Team &amp; roles</p>
              <p className="text-sm text-slate-500">Invite people and control their access.</p>
            </LinkRow>
            <LinkRow href="/settings/billing" icon={<Coins className="size-5" />}>
              <p className="font-medium text-slate-800">Billing &amp; plan</p>
              <p className="text-sm text-slate-500">Your plan, product usage and upgrades.</p>
            </LinkRow>
            <LinkRow href="/settings/audit" icon={<Activity className="size-5" />}>
              <p className="font-medium text-slate-800">Audit log</p>
              <p className="text-sm text-slate-500">A record of sensitive business actions.</p>
            </LinkRow>
            <div className="flex items-center gap-4 py-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <Shield className="size-5" />
              </span>
              <div>
                <p className="font-medium text-slate-800">Passwords</p>
                <p className="text-sm text-slate-500">
                  Self-service password reset lives on the login screen.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  function Row({ label, value }: { label: string; value?: string }) {
    return (
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="mt-0.5 font-medium text-slate-800">{value ?? '—'}</dd>
      </div>
    );
  }
}

function LinkRow({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className="flex items-center gap-4 py-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      <span className="text-slate-300">→</span>
    </a>
  );
}
