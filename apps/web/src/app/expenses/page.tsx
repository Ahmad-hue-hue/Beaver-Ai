'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Wallet as WalletIcon } from '@/components/ui/icon';
import { formatMoney } from '@/lib/money';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Expense {
  id: string;
  reference: string;
  category: string;
  amount: string;
  method: string;
  payee: string | null;
  paidAt: string;
  note: string | null;
}
interface ExpenseList { data: Expense[]; pagination: { total: number } }

const money = (v: string | number) => formatMoney(Number(v), { currency: 'TZS', symbolless: true });

const CATEGORIES = [
  ['RENT', 'Rent'],
  ['UTILITIES', 'Utilities'],
  ['SALARY', 'Salary'],
  ['TRANSPORT', 'Transport'],
  ['MARKETING', 'Marketing'],
  ['MAINTENANCE', 'Maintenance'],
  ['OTHER', 'Other'],
] as const;

export default function ExpensesPage() {
  return (
    <AppShell>
      <ExpensesContent />
    </AppShell>
  );
}

function ExpensesContent() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const [category, setCategory] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', category],
    queryFn: () =>
      api.get<ExpenseList>(`/expenses?limit=100${category ? `&category=${category}` : ''}`, { accessToken: token }),
    enabled: !!token,
  });

  const expenses = data?.data ?? [];
  const total = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Expenses</h1>
          <p className="mt-1 text-slate-500">
            {isLoading ? 'Loading…' : `${expenses.length} shown · ${money(total)} spent`}
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="size-4" /> : <Plus className="size-4" strokeWidth={2.5} />}
          {adding ? 'Close' : 'Add expense'}
        </Button>
      </header>

      {adding && <AddExpense token={token} onDone={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['expenses'] }); }} />}

      <div className="mt-7 flex flex-wrap gap-1.5">
        {[['', 'All'], ...CATEGORIES].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setCategory(value as string)}
            className={`tap rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              category === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-hairline pb-2 text-xs font-medium uppercase tracking-wide text-slate-400 sm:grid-cols-[1fr_auto_auto]">
          <span>Expense</span>
          <span className="hidden text-right sm:block">Category</span>
          <span className="text-right">Amount</span>
        </div>

        {isLoading ? (
          <p className="py-8 text-slate-400">Loading…</p>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <WalletIcon className="size-7" />
            </span>
            <p className="mt-4 font-medium text-slate-700">No expenses yet</p>
            <p className="mt-1 text-slate-500">Record what the business spends — rent, salaries, stock transport and more.</p>
          </div>
        ) : (
          expenses.map((e) => (
            <div key={e.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-hairline py-3 sm:grid-cols-[1fr_auto_auto]">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{e.payee ?? e.reference}</p>
                <p className="truncate font-mono text-xs text-slate-400">
                  <span className="sm:hidden">{e.category[0] + e.category.slice(1).toLowerCase()} · </span>
                  {e.reference} · {new Date(e.paidAt).toLocaleDateString('en-GB')}
                  {e.note ? ` · ${e.note}` : ''}
                </p>
              </div>
              <span className="hidden rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 sm:inline-block">
                {e.category[0] + e.category.slice(1).toLowerCase()}
              </span>
              <p className="tabular text-right font-medium text-red-600">−{money(e.amount)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddExpense({ token, onDone }: { token?: string; onDone: () => void }) {
  const [form, setForm] = React.useState({ category: 'RENT', amount: '', payee: '', note: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/expenses', {
        category: form.category,
        amount: Number(form.amount),
        payee: form.payee.trim() || undefined,
        note: form.note.trim() || undefined,
      }, { accessToken: token }),
    onSuccess: onDone,
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="mt-6 rounded-xl bg-slate-50/60 px-6 py-6">
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="h-11 w-full border-0 border-b border-hairline bg-transparent px-0 text-lg text-slate-900 outline-none focus:border-brand-600"
          >
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount (TZS)">
          <Input type="number" inputMode="decimal" placeholder="50000" value={form.amount} onChange={set('amount')} required min="0.01" />
        </Field>
        <Field label="Paid to" hint="Optional">
          <Input placeholder="e.g. TANESCO" value={form.payee} onChange={set('payee')} />
        </Field>
        <Field label="Note" hint="Optional">
          <Input placeholder="What was this for?" value={form.note} onChange={set('note')} />
        </Field>
      </div>

      {mutation.isError && (
        <p className="mt-4 text-sm text-red-600">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Could not record expense.'}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" loading={mutation.isPending}>Save expense</Button>
      </div>
    </form>
  );
}
