'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, Package } from '@/components/ui/icon';
import { formatMoney } from '@/lib/money';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

interface Stats {
  period: string;
  salesCount: number;
  revenue: string;
  cogs: string;
  grossProfit: string;
  expenses: string;
  netProfit: string;
  marginPct: number;
}
interface TrendRow { date: string; revenue: string; profit: string }
interface TopProduct {
  productId: string;
  name: string;
  quantity: string;
  revenue: string;
  grossProfit: string;
  marginPct: number;
}
interface Debtor { customerId: string; name: string; balance: string }

const money = (v: string | number) => formatMoney(v, { currency: 'TZS', symbolless: true });

export default function ReportsPage() {
  return (
    <AppShell>
      <ReportsContent />
    </AppShell>
  );
}

function ReportsContent() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [period, setPeriod] = React.useState('today');

  const stats = useQuery({
    queryKey: ['analytics', 'stats', period],
    queryFn: () => api.get<Stats>(`/analytics/stats?period=${period}`, { accessToken: token }),
    enabled: !!token,
  });
  const trend = useQuery({
    queryKey: ['analytics', 'trend'],
    queryFn: () => api.get<TrendRow[]>('/analytics/trend?days=14', { accessToken: token }),
    enabled: !!token,
  });
  const top = useQuery({
    queryKey: ['analytics', 'top'],
    queryFn: () => api.get<TopProduct[]>('/analytics/top-products?limit=8', { accessToken: token }),
    enabled: !!token,
  });
  const debtors = useQuery({
    queryKey: ['analytics', 'debtors'],
    queryFn: () => api.get<Debtor[]>('/analytics/debtors?limit=6', { accessToken: token }),
    enabled: !!token,
  });

  const unauthorized =
    (stats.error instanceof ApiError && stats.error.status === 403) ||
    (trend.error instanceof ApiError && trend.error.status === 403);

  if (unauthorized) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <p className="text-lg font-medium text-slate-800">No access to reports</p>
        <p className="mt-1 text-slate-500">
          Your role doesn&apos;t have permission to view reports. Ask the shop owner.
        </p>
      </div>
    );
  }

  const s = stats.data;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reports</h1>
          <p className="mt-1 text-slate-500">Profit, trends and the numbers behind your shop.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'tap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                period === p.value ? 'bg-surface text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Profit & loss */}
      <div className="mt-8 grid grid-cols-2 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Revenue" value={s ? money(s.revenue) : '—'} sub={s ? `${s.salesCount} sale${s.salesCount === 1 ? '' : 's'}` : undefined} />
        <Kpi label="Cost of goods" value={s ? money(s.cogs) : '—'} divide />
        <Kpi label="Gross profit" value={s ? money(s.grossProfit) : '—'} tone={s && Number(s.grossProfit) >= 0 ? 'ok' : 'warn'} divide />
        <Kpi label="Expenses" value={s ? money(s.expenses) : '—'} tone="warn" divide />
        <Kpi label="Net profit" value={s ? money(s.netProfit) : '—'} tone={s && Number(s.netProfit) >= 0 ? 'ok' : 'warn'} divide />
        <Kpi label="Margin" value={s ? `${s.marginPct}%` : '—'} divide />
      </div>

      {/* Trend */}
      <Section title="Sales trend" iconOffset>
        {trend.isLoading ? (
          <p className="text-slate-400">Loading…</p>
        ) : trend.data?.length ? (
          <MiniBars data={trend.data} />
        ) : (
          <p className="text-slate-400">No sales yet — revenue by day will appear here.</p>
        )}
      </Section>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        {/* Top products */}
        <div>
          <div className="flex items-center gap-2 border-b border-hairline pb-2">
            <Package className="size-4 text-slate-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Top products
            </h2>
          </div>
          {top.isLoading ? (
            <p className="py-6 text-sm text-slate-400">Loading…</p>
          ) : top.data?.length ? (
            <div className="divide-y divide-hairline">
              {top.data.map((p, i) => (
                <div key={p.productId} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3">
                  <span className="font-mono text-sm text-slate-300">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      {money(p.quantity)} sold · {p.marginPct}% margin
                    </p>
                  </div>
                  <p className="tabular font-medium text-slate-900">{money(p.revenue)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-sm text-slate-400">No sales to rank yet.</p>
          )}
        </div>

        {/* Top debtors */}
        <div>
          <div className="flex items-center gap-2 border-b border-hairline pb-2">
            <Users className="size-4 text-slate-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Top debtors
            </h2>
          </div>
          {debtors.isLoading ? (
            <p className="py-6 text-sm text-slate-400">Loading…</p>
          ) : debtors.data?.length ? (
            <div className="divide-y divide-hairline">
              {debtors.data.map((d) => (
                <div key={d.customerId} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
                  <p className="truncate font-medium text-slate-800">{d.name}</p>
                  <p className="tabular font-semibold text-amber-600">{money(d.balance)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <Users className="size-5" />
              </span>
              <p className="mt-3 text-sm text-slate-500">No outstanding debt. Everyone&apos;s settled up 🎉</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, iconOffset }: { title: string; children: React.ReactNode; iconOffset?: boolean }) {
  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 border-b border-hairline pb-2">
        {iconOffset && <BarChart3 className="size-4 text-slate-400" />}
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  divide,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'ok' | 'warn';
  divide?: boolean;
}) {
  return (
    <div className={divide ? 'sm:border-l sm:border-hairline sm:pl-6' : ''}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="tabular mt-1.5 text-xl font-semibold tracking-tight text-slate-900">{value}</p>
      {sub && (
        <p className={cn('mt-1 text-sm', tone === 'ok' ? 'text-brand-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-400')}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** Lightweight inline SVG stepline of daily revenue. */
function MiniBars({ data }: { data: TrendRow[] }) {
  const values = data.map((d) => Number(d.revenue));
  const max = Math.max(...values, 1);
  const width = 720;
  const height = 160;
  const bw = width / data.length;
  return (
    <div className="flex items-end gap-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" aria-hidden>
        {data.map((d, i) => {
          const h = Math.max((Number(d.revenue) / max) * height, 1);
          return (
            <rect
              key={d.date}
              x={i * bw + 2}
              y={height - h}
              width={bw - 4}
              height={h}
              rx={2}
              className="fill-brand-500/70"
            />
          );
        })}
      </svg>
    </div>
  );
}
