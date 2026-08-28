'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, Coins, Users as UsersIcon, Plus } from '@/components/ui/icon';
import { formatMoney } from '@/lib/money';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Debtor {
  id: string;
  name: string;
  phone: string | null;
  balance: string;
  creditLimit: string | null;
}
interface Overview { data: Debtor[]; pagination: { total: number } }
interface DebtEntry {
  id: string;
  type: 'SALE_CREDIT' | 'PAYMENT' | 'ADJUSTMENT';
  amount: string;
  balanceAfter: string;
  sourceType: string;
  note: string | null;
  createdAt: string;
}
interface Statement {
  customer: { id: string; name: string };
  balance: string;
  entries: DebtEntry[];
}

const money = (v: string | number) => formatMoney(Number(v), { currency: 'TZS', symbolless: true });

export default function CustomersPage() {
  return (
    <AppShell>
      <CustomersContent />
    </AppShell>
  );
}

function CustomersContent() {
  const { session } = useAuth();
  const token = session?.accessToken;

  const { data: aging, isLoading: agingLoading } = useQuery({
    queryKey: ['debts', 'aging'],
    queryFn: () => api.get<{ totals: { current: string; days1to30: string; days31to60: string; days60plus: string; total: string } }>('/debts/aging', { accessToken: token }),
    enabled: !!token,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Customers</h1>
        <p className="mt-1 text-slate-500">
          {agingLoading ? 'Loading…' : `${money(aging?.totals.total ?? 0)} outstanding`}
        </p>
      </header>

      {/* Debt aging summary */}
      {!agingLoading && aging && (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 text-center sm:grid-cols-4 sm:gap-4">
          {[
            ['Current', aging.totals.current],
            ['1–30d', aging.totals.days1to30],
            ['31–60d', aging.totals.days31to60],
            ['60d+', aging.totals.days60plus],
          ].map(([label, value]) => (
            <div key={label as string} className="border-b border-hairline pb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
              <p className="tabular mt-1 text-lg font-medium text-slate-900">{money(value as string)}</p>
            </div>
          ))}
        </div>
      )}

      <DebtorsList token={token} />
    </div>
  );
}

function DebtorsList({ token }: { token?: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['debts', 'overview', debounced],
    queryFn: () => api.get<Overview>(`/debts/overview?limit=100${debounced ? `&search=${encodeURIComponent(debounced)}` : ''}`, { accessToken: token }),
    enabled: !!token,
  });

  const debtors = data?.data ?? [];

  return (
    <div className="mt-8">
      <div className="flex max-w-sm items-center gap-2.5 border-b border-hairline py-2 focus-within:border-brand-600">
        <Search className="size-[18px] text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a customer with a balance…"
          className="w-full bg-transparent text-base outline-none placeholder:text-slate-300"
        />
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-hairline pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Customer</span>
          <span className="text-right">Owes</span>
        </div>

        {isLoading ? (
          <p className="py-8 text-slate-400">Loading…</p>
        ) : debtors.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <UsersIcon className="size-7" />
            </span>
            <p className="mt-4 font-medium text-slate-700">
              {debounced ? `No customers named “${debounced}”.` : 'No outstanding balances'}
            </p>
            <p className="mt-1 text-slate-500">
              {debounced ? '' : 'Customers show up here once they owe on a credit sale.'}
            </p>
          </div>
        ) : (
          debtors.map((d) => (
            <div
              key={d.id}
              className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-hairline py-3"
            >
              <button onClick={() => { setSelected(d.id); qc.invalidateQueries({ queryKey: ['debts', 'statement'] }); }} className="min-w-0 text-left hover:bg-slate-50">
                <p className="truncate font-medium text-slate-900">{d.name}</p>
                <p className="truncate font-mono text-xs text-slate-400">{d.phone ?? '—'}</p>
              </button>
              <div className="flex items-center gap-3">
                <p className="tabular text-right font-medium text-amber-700">{money(d.balance)}</p>
                <Button size="sm" variant="ghost" onClick={() => setSelected(d.id)}>
                  <Coins className="size-4" /> Pay
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <PaymentSheet
          customerId={selected}
          token={token}
          onClose={() => setSelected(null)}
          onPaid={() => qc.invalidateQueries({ queryKey: ['debts'] })}
        />
      )}
    </div>
  );
}

function PaymentSheet({ customerId, token, onClose, onPaid }: { customerId: string; token?: string; onClose: () => void; onPaid: () => void }) {
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState('CASH');
  const [note, setNote] = React.useState('');
  const qc = useQueryClient();

  const { data: statement } = useQuery({
    queryKey: ['debts', 'statement', customerId],
    queryFn: () => api.get<Statement>(`/debts/customers/${customerId}/statement`, { accessToken: token }),
    enabled: !!token && !!customerId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/debts/customers/${customerId}/payments`, {
        amount: Number(amount),
        method,
        note: note.trim() || undefined,
      }, { accessToken: token }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); onPaid(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface px-6 py-6 shadow-xl"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {statement?.customer.name ?? 'Customer'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="size-5" />
          </button>
        </header>

        <p className="mt-3 border-b border-hairline pb-4">
          <span className="text-sm text-slate-500">Owes </span>
          <span className="tabular text-xl font-semibold text-amber-700">{money(statement?.balance ?? 0)}</span>
        </p>

        {/* Statement */}
        <div className="mt-5 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Statement</p>
          <div className="mt-2">
            {statement?.entries.length === 0 ? (
              <p className="py-6 text-sm text-slate-400">No activity yet.</p>
            ) : statement?.entries.slice().reverse().map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 border-b border-hairline py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {e.type === 'PAYMENT' ? 'Payment' : e.type === 'SALE_CREDIT' ? 'Credit sale' : 'Adjustment'}
                  </p>
                  <p className="truncate font-mono text-xs text-slate-400">
                    {new Date(e.createdAt).toLocaleDateString('en-GB')}
                    {e.note ? ` · ${e.note}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`tabular text-sm font-medium ${e.amount.startsWith('-') ? 'text-brand-700' : 'text-slate-900'}`}>
                    {e.amount.startsWith('-') ? '' : '+'}{money(e.amount.replace('-', ''))}
                  </p>
                  <p className="tabular font-mono text-[11px] text-slate-400">bal {money(e.balanceAfter)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Record payment */}
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="mt-6 rounded-xl bg-slate-50/60 px-5 py-5"
        >
          <p className="mb-4 text-sm font-medium text-slate-700">Record payment</p>
          <div className="grid gap-4">
            <Field label="Amount (TZS)">
              <Input type="number" inputMode="decimal" placeholder="5000" value={amount} onChange={(e) => setAmount(e.target.value)} required min="0.01" />
            </Field>
            <Field label="Method">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-11 w-full border-0 border-b border-hairline bg-transparent px-0 text-lg text-slate-900 outline-none focus:border-brand-600"
              >
                <option value="CASH">Cash</option>
                <option value="MOBILE_MONEY">Mobile money</option>
                <option value="BANK">Bank</option>
                <option value="CARD">Card</option>
              </select>
            </Field>
            <Field label="Note" hint="Optional">
              <Input placeholder="e.g. M-Pesa received" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>

          {mutation.isError && (
            <p className="mt-4 text-sm text-red-600">
              {mutation.error instanceof ApiError ? mutation.error.message : 'Could not record payment.'}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={mutation.isPending} disabled={!amount || Number(amount) <= 0}>
              <Plus className="size-4" /> Record payment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
