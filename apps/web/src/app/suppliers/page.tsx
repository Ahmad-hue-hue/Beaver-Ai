'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X, Trash2, Truck as TruckIcon } from '@/components/ui/icon';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  _count?: { purchases: number };
}
interface SupplierList { data: Supplier[]; pagination: { total: number } }

export default function SuppliersPage() {
  return (
    <AppShell>
      <SuppliersContent />
    </AppShell>
  );
}

function SuppliersContent() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();

  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', debounced],
    queryFn: () =>
      api.get<SupplierList>(`/suppliers?limit=100${debounced ? `&search=${encodeURIComponent(debounced)}` : ''}`, { accessToken: token }),
    enabled: !!token,
  });

  const suppliers = data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Suppliers</h1>
          <p className="mt-1 text-slate-500">{isLoading ? 'Loading…' : `${data?.pagination.total ?? 0} suppliers`}</p>
        </div>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="size-4" /> : <Plus className="size-4" strokeWidth={2.5} />}
          {adding ? 'Close' : 'Add supplier'}
        </Button>
      </header>

      {adding && <AddSupplier token={token} onDone={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['suppliers'] }); }} />}

      <div className="mt-7 flex max-w-sm items-center gap-2.5 border-b border-hairline py-2 focus-within:border-brand-600">
        <Search className="size-[18px] text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers…"
          className="w-full bg-transparent text-base outline-none placeholder:text-slate-300"
        />
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-hairline pb-2 text-xs font-medium uppercase tracking-wide text-slate-400 sm:grid-cols-[1fr_auto_auto_auto]">
          <span>Supplier</span>
          <span className="text-right">Purchases</span>
          <span className="hidden text-right sm:block">Phone</span>
          <span className="w-9" />
        </div>

        {isLoading ? (
          <p className="py-8 text-slate-400">Loading suppliers…</p>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <TruckIcon className="size-7" />
            </span>
            <p className="mt-4 font-medium text-slate-700">
              {debounced ? `No suppliers match “${debounced}”.` : 'No suppliers yet'}
            </p>
            <p className="mt-1 text-slate-500">Add your first supplier to start recording purchases.</p>
          </div>
        ) : (
          suppliers.map((s) => (
            <div key={s.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-hairline py-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{s.name}</p>
                <p className="truncate font-mono text-xs text-slate-400">
                  {[s.email, s.address].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <p className="tabular text-right text-slate-500">{s._count?.purchases ?? 0}</p>
              <p className="tabular hidden text-right text-slate-500 sm:block">{s.phone ?? '—'}</p>
              <DeleteSupplier supplier={s} token={token} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DeleteSupplier({ supplier, token }: { supplier: Supplier; token?: string }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.del(`/suppliers/${supplier.id}`, { accessToken: token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  if ((supplier._count?.purchases ?? 0) > 0) return <span className="w-9" />;

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      title="Delete supplier"
      className="grid size-9 place-items-center justify-self-end rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

function AddSupplier({ token, onDone }: { token?: string; onDone: () => void }) {
  const [form, setForm] = React.useState({ name: '', phone: '', email: '', address: '', note: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/suppliers', {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        note: form.note.trim() || undefined,
      }, { accessToken: token }),
    onSuccess: onDone,
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
      className="mt-6 rounded-xl bg-slate-50/60 px-6 py-6"
    >
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Business name">
            <Input autoFocus placeholder="e.g. Mtitu Wholesale" value={form.name} onChange={set('name')} required />
          </Field>
        </div>
        <Field label="Phone" hint="Optional">
          <Input placeholder="+255 7xx xxx xxx" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Email" hint="Optional">
          <Input type="email" placeholder="orders@mtitu.co.tz" value={form.email} onChange={set('email')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address" hint="Optional">
            <Input placeholder="Street, area, city" value={form.address} onChange={set('address')} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Note" hint="Optional">
            <Input placeholder="Anything to remember" value={form.note} onChange={set('note')} />
          </Field>
        </div>
      </div>

      {mutation.isError && (
        <p className="mt-4 text-sm text-red-600">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Could not save supplier.'}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" loading={mutation.isPending}>Save supplier</Button>
      </div>
    </form>
  );
}
