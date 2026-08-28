'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, ShoppingBag as BagIcon } from '@/components/ui/icon';
import { formatMoney } from '@/lib/money';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Supplier { id: string; name: string }
interface Product { id: string; name: string; stockQuantity: string }
interface Purchase {
  id: string;
  reference: string;
  status: 'DRAFT' | 'RECEIVED' | 'CANCELLED';
  total: string;
  paidTotal: string;
  balanceDue: string;
  orderDate: string;
  supplier?: { name: string } | null;
  _count?: { items: number };
}
interface PurchaseList { data: Purchase[]; pagination: { total: number } }

const money = (v: string | number) => formatMoney(Number(v), { currency: 'TZS', symbolless: true });

const STATUS_BADGE: Record<Purchase['status'], string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  RECEIVED: 'bg-brand-50 text-brand-700',
  CANCELLED: 'bg-red-50 text-red-600',
};

export default function PurchasesPage() {
  return (
    <AppShell>
      <PurchasesContent />
    </AppShell>
  );
}

function PurchasesContent() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const [status, setStatus] = React.useState<'DRAFT' | 'RECEIVED' | 'CANCELLED' | ''>('');
  const [adding, setAdding] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', status],
    queryFn: () =>
      api.get<PurchaseList>(`/purchases?limit=100${status ? `&status=${status}` : ''}`, { accessToken: token }),
    enabled: !!token,
  });

  const purchases = data?.data ?? [];
  const drafted = purchases.filter((p) => p.status === 'DRAFT').length;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Purchases</h1>
          <p className="mt-1 text-slate-500">
            {isLoading ? 'Loading…' : `${data?.pagination.total ?? 0} purchases`}
            {drafted > 0 && <span className="text-amber-600"> · {drafted} awaiting receipt</span>}
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="size-4" /> : <Plus className="size-4" strokeWidth={2.5} />}
          {adding ? 'Close' : 'New purchase'}
        </Button>
      </header>

      {adding && <AddPurchase token={token} onDone={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['purchases'] }); }} />}

      {/* Status filter */}
      <div className="mt-7 flex flex-wrap gap-1.5">
        {(['', 'DRAFT', 'RECEIVED', 'CANCELLED'] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`tap rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s === '' ? 'All' : s[0] + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-hairline pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Purchase</span>
          <span className="text-right">Items</span>
          <span className="text-right">Status</span>
          <span className="text-right">Total</span>
        </div>

        {isLoading ? (
          <p className="py-8 text-slate-400">Loading…</p>
        ) : purchases.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <BagIcon className="size-7" />
            </span>
            <p className="mt-4 font-medium text-slate-700">No purchases yet</p>
            <p className="mt-1 text-slate-500">Record a purchase to restock and track supplier costs.</p>
          </div>
        ) : (
          purchases.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedId(p.id); qc.invalidateQueries({ queryKey: ['purchase', p.id] }); }}
              className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-hairline py-3 text-left hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-slate-900">
                  <span className="font-mono text-sm">{p.reference}</span>
                </p>
                <p className="truncate text-xs text-slate-400">
                  {p.supplier?.name ?? '—'}
                  {Number(p.balanceDue) > 0 && <span className="text-amber-700"> · owes {money(p.balanceDue)}</span>}
                </p>
              </div>
              <p className="tabular text-right text-slate-500">{p._count?.items ?? 0}</p>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status]}`}>
                {p.status[0] + p.status.slice(1).toLowerCase()}
              </span>
              <p className="tabular text-right font-medium text-slate-900">{money(p.total)}</p>
            </button>
          ))
        )}
      </div>

      {selectedId && <PurchaseSheet purchaseId={selectedId} token={token} onClose={() => setSelectedId(null)} onChanged={() => qc.invalidateQueries({ queryKey: ['purchases'] })} />}
    </div>
  );
}

function PurchaseSheet({ purchaseId, token, onClose, onChanged }: { purchaseId: string; token?: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase', purchaseId],
    queryFn: () => api.get<any>(`/purchases/${purchaseId}`, { accessToken: token }),
    enabled: !!token && !!purchaseId,
  });

  const receive = useMutation({
    mutationFn: () => api.post(`/purchases/${purchaseId}/receive`, undefined, { accessToken: token }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['purchase', purchaseId] }); onChanged(); },
  });
  const cancel = useMutation({
    mutationFn: () => api.post(`/purchases/${purchaseId}/cancel`, undefined, { accessToken: token }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['purchase', purchaseId] }); onChanged(); },
  });

  const isDraft = purchase?.status === 'DRAFT';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface px-6 py-6 shadow-xl">
        <header className="flex items-center justify-between">
          <h2 className="font-mono text-lg font-semibold text-slate-900">{purchase?.reference ?? 'Purchase'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="size-5" /></button>
        </header>

        {isLoading && <p className="py-6 text-slate-400">Loading…</p>}

        {purchase && (
          <>
            <div className="mt-4 border-b border-hairline pb-4">
              <p className="text-sm text-slate-500">Supplier</p>
              <p className="mt-0.5 font-medium text-slate-900">{purchase.supplier?.name ?? '—'}</p>
              <div className="mt-3 flex items-baseline justify-between">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[purchase.status as Purchase['status']]}`}>
                  {purchase.status}
                </span>
                <p className="tabular text-right font-semibold text-slate-900">{money(purchase.total)}</p>
              </div>
            </div>

            {/* Items */}
            <div className="mt-5 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Items</p>
              <div className="mt-2">
                {(purchase.items ?? []).map((it: any) => (
                  <div key={it.id} className="flex items-baseline justify-between gap-3 border-b border-hairline py-2.5">
                    <p className="truncate text-sm font-medium text-slate-800">{it.nameSnapshot}</p>
                    <p className="tabular shrink-0 text-sm text-slate-600">
                      {Number(it.quantity)} × {money(it.unitCost)}
                      <span className="ml-2 tabular font-medium text-slate-900">{money(it.lineTotal)}</span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1 border-b border-hairline pb-4 text-sm">
                <div className="flex justify-between text-slate-500"><span>Paid</span><span className="tabular">{money(purchase.paidTotal)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Balance due</span><span className="tabular text-amber-700">{money(purchase.balanceDue)}</span></div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6">
              {isDraft ? (
                <div className="flex flex-col gap-2">
                  <Button onClick={() => receive.mutate()} loading={receive.isPending} disabled={cancel.isPending}>
                    Receive goods
                  </Button>
                  {Number(purchase.balanceDue) > 0 && (
                    <p className="text-center text-xs text-slate-400">
                      Under-paid — supplier still owes {money(purchase.balanceDue)}.
                    </p>
                  )}
                  <Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending} disabled={receive.isPending}>
                    Cancel purchase
                  </Button>
                </div>
              ) : (
                <p className="text-center text-sm text-slate-400">
                  {purchase.status === 'RECEIVED' ? 'Goods received — stock and cost updated.' : 'This purchase was cancelled.'}
                </p>
              )}

              {(receive.isError || cancel.isError) && (
                <p className="mt-3 text-sm text-red-600">
                  {receive.error instanceof ApiError ? receive.error.message : cancel.error instanceof ApiError ? cancel.error.message : 'Something went wrong.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddPurchase({ token, onDone }: { token?: string; onDone: () => void }) {
  const qc = useQueryClient();

  const suppliers = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => api.get<any>(`/suppliers?limit=100`, { accessToken: token }),
    enabled: !!token,
  });
  const products = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => api.get<any>(`/products?limit=100`, { accessToken: token }),
    enabled: !!token,
  });

  const [supplierId, setSupplierId] = React.useState('');
  const [paidAmount, setPaidAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [lines, setLines] = React.useState([{ productId: '', quantity: '', unitCost: '' }]);

  const mappedProducts = products.data?.data ?? [];
  const productOptions = mappedProducts.filter((p: any) => !p.isService);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/purchases', {
        supplierId,
        paidAmount: paidAmount ? Number(paidAmount) : undefined,
        note: note.trim() || undefined,
        items: lines
          .filter((l) => l.productId && l.quantity)
          .map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity),
            unitCost: l.unitCost ? Number(l.unitCost) : 0,
          })),
      }, { accessToken: token }),
    onSuccess: onDone,
  });

  const updateLine = (idx: number, patch: Partial<(typeof lines)[number]>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="mt-6 rounded-xl bg-slate-50/60 px-6 py-6">
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field label="Supplier">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
            className="h-11 w-full border-0 border-b border-hairline bg-transparent px-0 text-lg text-slate-900 outline-none focus:border-brand-600"
          >
            <option value="">Select supplier…</option>
            {(suppliers.data?.data ?? []).map((s: Supplier) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Paid today (TZS)" hint="Optional — leave 0 to owe the supplier">
          <Input type="number" inputMode="decimal" placeholder="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
        </Field>
      </div>

      {/* Line items */}
      <div className="mt-5">
        <p className="mb-1.5 text-sm font-medium text-slate-600">Items</p>
        {lines.map((line, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto_auto] items-end gap-3 border-b border-hairline py-3">
            <Field label={idx === 0 ? 'Product' : ''}>
              <select
                value={line.productId}
                onChange={(e) => updateLine(idx, { productId: e.target.value })}
                className="h-11 w-full border-0 bg-transparent px-0 text-base text-slate-900 outline-none"
              >
                <option value="">Select product…</option>
                {productOptions.map((p: Product) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label={idx === 0 ? 'Qty' : ''}>
              <Input type="number" inputMode="decimal" placeholder="0" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} className="w-20 text-right" />
            </Field>
            <Field label={idx === 0 ? 'Cost' : ''}>
              <Input type="number" inputMode="decimal" placeholder="0" value={line.unitCost} onChange={(e) => updateLine(idx, { unitCost: e.target.value })} className="w-24 text-right" />
            </Field>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, { productId: '', quantity: '', unitCost: '' }])}
          className="tap mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <Plus className="size-4" /> Add line item
        </button>
      </div>

      <Field label="Note" hint="Optional">
        <Input placeholder="Anything to remember" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {mutation.isError && (
        <p className="mt-4 text-sm text-red-600">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Could not create purchase.'}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" loading={mutation.isPending} disabled={!supplierId}>
          Save purchase
        </Button>
      </div>
    </form>
  );
}
