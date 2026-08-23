'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from '@/components/ui/icon';
import { formatMoney } from '@/lib/money';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  stockQuantity: string;
  costPrice: string;
  sellingPrice: string;
  reorderLevel: string;
  category?: { name: string } | null;
  unit?: { abbreviation: string } | null;
}
interface ProductList {
  data: Product[];
  pagination: { total: number };
}

const money = (v: string | number) => formatMoney(Number(v), { currency: 'TZS', symbolless: true });
const isLow = (p: Product) => Number(p.reorderLevel) > 0 && Number(p.stockQuantity) <= Number(p.reorderLevel);

export default function ProductsPage() {
  return (
    <AppShell>
      <ProductsContent />
    </AppShell>
  );
}

function ProductsContent() {
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
    queryKey: ['products', debounced],
    queryFn: () =>
      api.get<ProductList>(
        `/products?limit=100${debounced ? `&search=${encodeURIComponent(debounced)}` : ''}`,
        { accessToken: token },
      ),
    enabled: !!token,
  });

  const products = data?.data ?? [];
  const lowCount = products.filter(isLow).length;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Products</h1>
          <p className="mt-1 text-slate-500">
            {isLoading ? 'Loading…' : `${data?.pagination.total ?? 0} items`}
            {lowCount > 0 && <span className="text-amber-600"> · {lowCount} low on stock</span>}
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="size-4" /> : <Plus className="size-4" strokeWidth={2.5} />}
          {adding ? 'Close' : 'Add product'}
        </Button>
      </header>

      {adding && <AddProduct token={token} onDone={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['products'] }); }} />}

      {/* Search */}
      <div className="mt-7 flex max-w-sm items-center gap-2.5 border-b border-hairline py-2 focus-within:border-brand-600">
        <Search className="size-[18px] text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, or barcode…"
          className="w-full bg-transparent text-base outline-none placeholder:text-slate-300"
        />
      </div>

      {/* List */}
      <div className="mt-6">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-hairline pb-2 text-xs font-medium uppercase tracking-wide text-slate-400 sm:grid-cols-[1fr_auto_auto_auto]">
          <span>Product</span>
          <span className="text-right">Stock</span>
          <span className="hidden text-right sm:block">Cost</span>
          <span className="text-right">Price</span>
        </div>

        {isLoading ? (
          <p className="py-8 text-slate-400">Loading products…</p>
        ) : products.length === 0 ? (
          <p className="py-8 text-slate-400">
            {debounced ? `No products match “${debounced}”.` : 'No products yet — add your first one above.'}
          </p>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-hairline py-3 sm:grid-cols-[1fr_auto_auto_auto]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{p.name}</p>
                <p className="truncate font-mono text-xs text-slate-400">
                  {[p.sku, p.category?.name].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <p className={`tabular text-right ${isLow(p) ? 'font-medium text-red-600' : 'text-slate-700'}`}>
                {Number(p.stockQuantity)} {p.unit?.abbreviation ?? ''}
                {isLow(p) && ' ⚠'}
              </p>
              <p className="tabular hidden text-right text-slate-400 sm:block">{money(p.costPrice)}</p>
              <p className="tabular text-right font-medium text-slate-900">{money(p.sellingPrice)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddProduct({ token, onDone }: { token?: string; onDone: () => void }) {
  const [form, setForm] = React.useState({ name: '', sku: '', costPrice: '', sellingPrice: '', openingStock: '', reorderLevel: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/products', {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        costPrice: form.costPrice ? Number(form.costPrice) : 0,
        sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : 0,
        openingStock: form.openingStock ? Number(form.openingStock) : 0,
        reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : 0,
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
          <Field label="Name">
            <Input autoFocus placeholder="Rice (white) 25kg" value={form.name} onChange={set('name')} required />
          </Field>
        </div>
        <Field label="SKU" hint="Optional">
          <Input placeholder="RICE-001" value={form.sku} onChange={set('sku')} />
        </Field>
        <Field label="Opening stock">
          <Input type="number" inputMode="decimal" placeholder="0" value={form.openingStock} onChange={set('openingStock')} />
        </Field>
        <Field label="Cost price (TZS)">
          <Input type="number" inputMode="decimal" placeholder="2000" value={form.costPrice} onChange={set('costPrice')} />
        </Field>
        <Field label="Selling price (TZS)">
          <Input type="number" inputMode="decimal" placeholder="2500" value={form.sellingPrice} onChange={set('sellingPrice')} />
        </Field>
        <Field label="Reorder level" hint="Alert when stock drops to this">
          <Input type="number" inputMode="decimal" placeholder="20" value={form.reorderLevel} onChange={set('reorderLevel')} />
        </Field>
      </div>

      {mutation.isError && (
        <p className="mt-4 text-sm text-red-600">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Could not save product.'}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" loading={mutation.isPending}>Save product</Button>
      </div>
    </form>
  );
}
