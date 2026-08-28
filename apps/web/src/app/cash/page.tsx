'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins as CoinsIcon, X } from '@/components/ui/icon';
import { formatMoney } from '@/lib/money';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface CashSession {
  id: string;
  reference: string;
  status: 'OPEN' | 'CLOSED';
  openingBalance: string;
  expectedCash: string | null;
  countedCash: string | null;
  variance: string | null;
  openedAt: string;
  closingAt: string | null;
}
interface Movement {
  id: string;
  type: string;
  amount: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
}
interface MovementList { data: Movement[]; pagination: { total: number } }

const money = (v: string | number) => formatMoney(Number(v), { currency: 'TZS', symbolless: true });

const TYPE_LABEL: Record<string, string> = {
  OPENING_BALANCE: 'Opening balance',
  SALE: 'Sales',
  EXPENSE: 'Expense',
  PURCHASE: 'Purchase',
  SUPPLIER_PAYMENT: 'Supplier payment',
  CUSTOMER_PAYMENT: 'Customer payment',
  DRAWING: 'Owner drawing',
  TRANSFER: 'Transfer',
  CLOSING_ADJUSTMENT: 'Adjustment',
};

export default function CashPage() {
  return (
    <AppShell>
      <CashContent />
    </AppShell>
  );
}

function CashContent() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();

  const { data: current, isLoading: sessionLoading } = useQuery({
    queryKey: ['cash', 'current'],
    queryFn: () => api.get<CashSession | null>('/cash/sessions/current', { accessToken: token }),
    enabled: !!token,
  });

  const { data: movements } = useQuery({
    queryKey: ['cash', 'movements'],
    queryFn: () => api.get<MovementList>('/cash/movements?limit=100', { accessToken: token }),
    enabled: !!token,
  });

  const all = movements?.data ?? [];
  const onDuty = all.filter((m) => m.type !== 'CLOSING_ADJUSTMENT');
  const running = onDuty.reduce((acc, m) => acc + Number(m.amount), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Cash</h1>
        <p className="mt-1 text-slate-500">
          {sessionLoading ? 'Loading…' : current?.status === 'OPEN' ? 'Till is open' : 'Till is closed'}
        </p>
      </header>

      {/* Till summary */}
      <div className="mt-6 flex items-end justify-between border-b border-hairline pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Cash in hand</p>
          <p className="tabular mt-1 text-3xl font-semibold text-slate-900">{money(running)}</p>
          <p className="mt-1 font-mono text-xs text-slate-400">{current?.reference ?? '—'}</p>
        </div>
        <div className="flex gap-2">
          {current?.status === 'OPEN' ? (
            <CloseTill sessionId={current.id} token={token} onClosed={() => qc.invalidateQueries({ queryKey: ['cash'] })} />
          ) : (
            <OpenTill token={token} onOpened={() => qc.invalidateQueries({ queryKey: ['cash'] })} />
          )}
        </div>
      </div>

      {/* Movements */}
      <div className="mt-6">
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-hairline pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Movement</span>
          <span className="text-right">Amount</span>
        </div>

        {all.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <CoinsIcon className="size-7" />
            </span>
            <p className="mt-4 font-medium text-slate-700">No movements yet</p>
            <p className="mt-1 text-slate-500">Sales, expenses, purchases and payments all feed this ledger.</p>
          </div>
        ) : (
          all.map((m) => {
            const positive = Number(m.amount) >= 0;
            return (
              <div key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-hairline py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{TYPE_LABEL[m.type] ?? m.type}</p>
                  <p className="truncate font-mono text-xs text-slate-400">
                    {m.reference ?? ''}{m.note ? ` · ${m.note}` : ''}
                    {m.reference || m.note ? ' · ' : ''}{new Date(m.createdAt).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <p className={`tabular text-right font-medium ${positive ? 'text-brand-700' : 'text-red-600'}`}>
                  {positive ? '+' : '−'}{money(Math.abs(Number(m.amount)))}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function OpenTill({ token, onOpened }: { token?: string; onOpened: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [openingBalance, setOpeningBalance] = React.useState('0');

  const mutation = useMutation({
    mutationFn: () => api.post('/cash/sessions/open', { openingBalance: Number(openingBalance) }, { accessToken: token }),
    onSuccess: () => { setOpen(false); onOpened(); },
  });

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Open till
      </Button>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="flex items-end gap-3">
      <Field label="Opening balance (TZS)">
        <Input type="number" inputMode="decimal" className="w-32 text-right" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
      </Field>
      <Button type="submit" size="sm" loading={mutation.isPending}>Start</Button>
      <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="size-5" /></button>
      {mutation.isError && <p className="text-sm text-red-600">{mutation.error instanceof ApiError ? mutation.error.message : ''}</p>}
    </form>
  );
}

function CloseTill({ sessionId, token, onClosed }: { sessionId: string; token?: string; onClosed: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [countedCash, setCountedCash] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(`/cash/sessions/${sessionId}/close`, { countedCash: Number(countedCash), notes: notes.trim() || undefined }, { accessToken: token }),
    onSuccess: () => { setOpen(false); onClosed(); },
  });

  if (!open) {
    return <Button size="sm" variant="subtle" onClick={() => setOpen(true)}>Close till</Button>;
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="flex items-end gap-3">
      <Field label="Counted cash">
        <Input type="number" inputMode="decimal" className="w-32 text-right" placeholder="0" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} required min="0" />
      </Field>
      <div className="hidden sm:block">
        <Field label="Notes" hint="Optional">
          <Input className="w-40" placeholder="Variance reason" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <Button type="submit" size="sm" loading={mutation.isPending}>Close</Button>
      <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="size-5" /></button>
      {mutation.isError && <p className="text-sm text-red-600">{mutation.error instanceof ApiError ? mutation.error.message : ''}</p>}
    </form>
  );
}
