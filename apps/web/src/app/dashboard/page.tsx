'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Package, ArrowRight } from '@/components/ui/icon';
import { formatMoney } from '@/lib/money';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Product {
  id: string;
  name: string;
  stockQuantity: string;
  costPrice: string;
  reorderLevel: string;
}
interface ProductList {
  data: Product[];
  pagination: { total: number };
}

function firstName(name: string) {
  return name.split(' ')[0] ?? name;
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { session } = useAuth();
  const token = session?.accessToken;

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'dashboard'],
    queryFn: () => api.get<ProductList>('/products?limit=100', { accessToken: token }),
    enabled: !!token,
  });

  const { data: summary } = useQuery({
    queryKey: ['sales', 'summary', 'today'],
    queryFn: () => api.get<{ count: number; revenue: string; itemsSold: string }>(
      '/sales/summary?period=today',
      { accessToken: token },
    ),
    enabled: !!token,
  });

  const products = data?.data ?? [];
  const totalItems = data?.pagination.total ?? 0;
  const stockValue = products.reduce(
    (sum, p) => sum + Number(p.stockQuantity) * Number(p.costPrice),
    0,
  );
  const lowStock = products.filter(
    (p) => Number(p.reorderLevel) > 0 && Number(p.stockQuantity) <= Number(p.reorderLevel),
  );

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Habari, {firstName(session?.user.name ?? '')} 👋
          </h1>
          <p className="mt-1 text-slate-500">
            {today} · {session?.memberships[0]?.businessName}
          </p>
        </div>
      </header>

      {/* KPIs — no boxes; separated by hairline rules. */}
      <div className="mt-10 grid grid-cols-2 gap-y-7 sm:grid-cols-4 sm:gap-y-0">
        <Kpi label="Products" value={isLoading ? '—' : String(totalItems)} sub="in catalogue" />
        <Kpi
          label="Stock value"
          value={isLoading ? '—' : formatMoney(stockValue, { currency: 'TZS' })}
          sub="at cost"
          divide
        />
        <Kpi
          label="Low on stock"
          value={isLoading ? '—' : String(lowStock.length)}
          sub={lowStock.length ? 'reorder soon' : 'all healthy'}
          tone={lowStock.length ? 'warn' : 'ok'}
          divide
        />
        <Kpi
          label="Today's sales"
          value={summary ? formatMoney(Number(summary.revenue), { currency: 'TZS' }) : '—'}
          sub={summary ? `${summary.count} sale${summary.count === 1 ? '' : 's'}` : 'no sales yet'}
          tone={summary && summary.count > 0 ? 'ok' : undefined}
          divide
        />
      </div>

      {/* Data-derived insight — a taste of the autonomous layer. */}
      <div className="mt-12 rounded-r-xl border-l-[3px] border-brand-600 bg-brand-50 px-6 py-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
          <Sparkles className="size-3.5" /> AI insight
        </p>
        <p className="mt-1.5 leading-relaxed text-slate-700">
          {isLoading
            ? 'Studying your catalogue…'
            : lowStock.length > 0
              ? `${lowStock.length} product${lowStock.length > 1 ? 's are' : ' is'} at or below reorder level — ${lowStock
                  .slice(0, 3)
                  .map((p) => p.name)
                  .join(', ')}${lowStock.length > 3 ? '…' : ''}. Restock before you run out.`
              : totalItems === 0
                ? 'No products yet. Add your first product to start tracking stock and margins.'
                : 'Stock levels look healthy. Once you start selling, I’ll watch trends and flag what needs attention.'}
        </p>
      </div>

      {/* Empty state / quick action */}
      {!isLoading && totalItems === 0 && (
        <div className="mt-12 flex flex-col items-center py-10 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <Package className="size-8" />
          </span>
          <p className="mt-4 text-lg font-medium text-slate-800">Your catalogue is empty</p>
          <p className="mt-1 max-w-sm text-slate-500">
            Add products with cost and selling prices to track stock, margins and low-stock alerts.
          </p>
          <Link
            href="/products"
            className="tap mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 font-medium text-white transition hover:bg-brand-700"
          >
            Add products <ArrowRight className="size-5" />
          </Link>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  muted,
  divide,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'ok' | 'warn';
  muted?: boolean;
  divide?: boolean;
}) {
  return (
    <div className={divide ? 'sm:border-l sm:border-hairline sm:pl-6' : ''}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={`tabular mt-1.5 text-2xl font-semibold tracking-tight ${
          muted ? 'text-slate-300' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
      {sub && (
        <p
          className={`mt-1 text-sm ${
            tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-brand-600' : 'text-slate-400'
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
