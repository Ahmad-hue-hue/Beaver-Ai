'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt as ReceiptIcon } from '@/components/ui/icon';
import { formatMoney } from '@/lib/money';
import { AppShell } from '@/components/app-shell';
import { Receipt, type ReceiptSale } from '@/components/receipt';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface SaleRow {
  id: string;
  reference: string;
  soldAt: string;
  status: 'COMPLETED' | 'VOIDED';
  total: string;
  balanceDue: string;
  customer?: { name: string } | null;
  cashier?: { name: string } | null;
  _count?: { items: number };
}
interface SaleList { data: SaleRow[]; pagination: { total: number } }

const money = (v: string | number) => formatMoney(Number(v), { currency: 'TZS', symbolless: true });

export default function SalesPage() {
  return (
    <AppShell>
      <SalesHistory />
    </AppShell>
  );
}

function SalesHistory() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const businessName = session?.memberships.find((m) => m.businessId === session.businessId)?.businessName ?? 'Sale';
  const [openId, setOpenId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'today'],
    queryFn: () => api.get<SaleList>('/sales?period=today&limit=100', { accessToken: token }),
    enabled: !!token,
  });

  const detail = useQuery({
    queryKey: ['sale', openId],
    queryFn: () => api.get<ReceiptSale>(`/sales/${openId}`, { accessToken: token }),
    enabled: !!token && !!openId,
  });

  const sales = data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sales</h1>
          <p className="mt-1 text-slate-500">{isLoading ? 'Loading…' : `Today · ${data?.pagination.total ?? 0} sales`}</p>
        </div>
      </header>

      <div className="mt-8">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-hairline pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Sale</span>
          <span className="text-right">Items</span>
          <span className="text-right">Total</span>
        </div>

        {isLoading ? (
          <p className="py-8 text-slate-400">Loading…</p>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <ReceiptIcon className="size-7" />
            </span>
            <p className="mt-4 font-medium text-slate-700">No sales today yet</p>
            <p className="mt-1 text-slate-500">Ring one up on the Point of sale screen.</p>
          </div>
        ) : (
          sales.map((s) => (
            <button
              key={s.id}
              onClick={() => setOpenId(s.id)}
              className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-hairline py-3 text-left hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-slate-900">
                  <span className="font-mono text-sm">{s.reference}</span>
                  {s.status === 'VOIDED' && <span className="rounded bg-red-50 px-1.5 text-xs text-red-600">voided</span>}
                  {Number(s.balanceDue) > 0 && <span className="rounded bg-amber-50 px-1.5 text-xs text-amber-700">credit</span>}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {new Date(s.soldAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  {s.customer?.name && ` · ${s.customer.name}`}
                  {s.cashier?.name && ` · ${s.cashier.name}`}
                </p>
              </div>
              <p className="tabular text-right text-slate-500">{s._count?.items ?? 0}</p>
              <p className={`tabular text-right font-medium ${s.status === 'VOIDED' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {money(s.total)}
              </p>
            </button>
          ))
        )}
      </div>

      {openId && detail.data && (
        <Receipt sale={detail.data} businessName={businessName} onNewSale={() => setOpenId(null)} />
      )}
    </div>
  );
}
