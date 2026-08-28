'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Minus, Plus, Search, ShoppingCart, Trash2, X, UserPlus } from '@/components/ui/icon';
import { formatMoney } from '@/lib/money';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Receipt, type ReceiptSale } from '@/components/receipt';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  sellingPrice: string;
  taxRate: string;
  stockQuantity: string;
  isService: boolean;
  trackInventory: boolean;
  unit?: { abbreviation: string } | null;
}
interface ProductList { data: Product[] }
interface Customer { id: string; name: string; phone: string | null }

type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'BANK' | 'CARD';
const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'CASH', label: 'Cash' },
  { key: 'MOBILE_MONEY', label: 'Mobile' },
  { key: 'BANK', label: 'Bank' },
  { key: 'CARD', label: 'Card' },
];

const money = (v: number) => formatMoney(v, { currency: 'TZS', symbolless: true });

interface CartLine { product: Product; qty: number }

export default function PosPage() {
  return (
    <AppShell>
      <Pos />
    </AppShell>
  );
}

function Pos() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const canDiscount = session?.role === 'OWNER' || session?.role === 'MANAGER';
  const businessName = session?.memberships.find((m) => m.businessId === session.businessId)?.businessName ?? 'Sale';

  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [cart, setCart] = React.useState<Map<string, CartLine>>(new Map());
  const [tenders, setTenders] = React.useState<{ method: PaymentMethod; amount: string }[]>([
    { method: 'CASH', amount: '' },
  ]);
  const [discount, setDiscount] = React.useState('');
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [idemKey, setIdemKey] = React.useState(() => crypto.randomUUID());
  const [receipt, setReceipt] = React.useState<ReceiptSale | null>(null);
  const [cartOpen, setCartOpen] = React.useState(false); // mobile bottom-sheet

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data } = useQuery({
    queryKey: ['pos-products', debounced],
    queryFn: () =>
      api.get<ProductList>(`/products?limit=50${debounced ? `&search=${encodeURIComponent(debounced)}` : ''}`, {
        accessToken: token,
      }),
    enabled: !!token,
  });
  const products = data?.data ?? [];

  const lines = [...cart.values()];
  const subtotal = lines.reduce((s, l) => s + Number(l.product.sellingPrice) * l.qty, 0);
  const tax = lines.reduce((s, l) => s + Number(l.product.sellingPrice) * l.qty * Number(l.product.taxRate), 0);
  const disc = Math.min(canDiscount ? Number(discount) || 0 : 0, subtotal + tax);
  const total = Math.max(0, subtotal + tax - disc);
  const paid = tenders.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const change = Math.max(0, paid - total);
  const due = Math.max(0, total - paid);

  function addToCart(p: Product) {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(p.id);
      next.set(p.id, { product: p, qty: (line?.qty ?? 0) + 1 });
      return next;
    });
  }
  function setQty(id: string, qty: number) {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(id);
      else { const l = next.get(id); if (l) next.set(id, { ...l, qty }); }
      return next;
    });
  }

  function resetSale() {
    setCart(new Map());
    setTenders([{ method: 'CASH', amount: '' }]);
    setDiscount('');
    setCustomer(null);
    setIdemKey(crypto.randomUUID());
    setReceipt(null);
    setSearch('');
    setCartOpen(false);
  }

  const checkout = useMutation({
    mutationFn: () =>
      api.post<ReceiptSale>(
        '/sales',
        {
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
          payments: tenders.filter((t) => Number(t.amount) > 0).map((t) => ({ method: t.method, amount: Number(t.amount) })),
          discount: disc > 0 ? disc : undefined,
          customerId: customer?.id,
          idempotencyKey: idemKey,
        },
        { accessToken: token },
      ),
    onSuccess: (sale) => setReceipt(sale),
  });

  const canCheckout = lines.length > 0 && (due === 0 || !!customer);
  const cartCount = lines.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="lg:grid lg:h-[calc(100dvh-5rem)] lg:grid-cols-[1fr_400px] lg:gap-8">
      {/* Catalogue */}
      <div className="flex flex-col lg:min-h-0">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Point of sale</h1>
        </header>
        <div className="mb-4 flex items-center gap-2.5 border-b border-hairline py-2 focus-within:border-brand-600">
          <Search className="size-5 text-slate-400" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or scan a product…"
            className="w-full bg-transparent text-lg outline-none placeholder:text-slate-300"
          />
        </div>

        <div className="grid auto-rows-min grid-cols-2 gap-2 pb-6 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-4">
          {products.length === 0 ? (
            <p className="col-span-full py-10 text-center text-slate-400">No products found.</p>
          ) : (
            products.map((p) => {
              const out = p.trackInventory && !p.isService && Number(p.stockQuantity) <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={out}
                  className="tap flex flex-col justify-between rounded-xl border border-hairline p-3 text-left transition-colors hover:border-brand-600 hover:bg-brand-50/40 disabled:opacity-40"
                >
                  <span className="line-clamp-2 text-sm font-medium text-slate-800">{p.name}</span>
                  <span className="mt-2 flex items-baseline justify-between">
                    <span className="tabular font-semibold text-slate-900">{money(Number(p.sellingPrice))}</span>
                    {p.trackInventory && !p.isService && (
                      <span className={`text-xs ${out ? 'text-red-500' : 'text-slate-400'}`}>
                        {out ? 'out' : `${Number(p.stockQuantity)}${p.unit?.abbreviation ?? ''}`}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Cart + pay — a static column on desktop, a slide-up sheet on mobile */}
      <div
        className={cn(
          'flex flex-col bg-slate-50 p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] transition-transform duration-300',
          'fixed inset-0 z-50 lg:static lg:z-auto lg:min-h-0 lg:translate-y-0 lg:rounded-2xl lg:bg-slate-50/70',
          cartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0',
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 font-medium text-slate-700">
            <ShoppingCart className="size-5 text-brand-600" /> Cart
          </p>
          <div className="flex items-center gap-4">
            {lines.length > 0 && (
              <button onClick={resetSale} className="text-sm text-slate-400 hover:text-red-600">Clear</button>
            )}
            <button
              onClick={() => setCartOpen(false)}
              aria-label="Close cart"
              className="text-slate-400 hover:text-slate-600 lg:hidden"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-slate-400">
              <p>Tap a product to add it.</p>
            </div>
          ) : (
            lines.map((l) => (
              <div key={l.product.id} className="flex items-center gap-3 border-b border-hairline py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{l.product.name}</p>
                  <p className="tabular text-xs text-slate-400">{money(Number(l.product.sellingPrice))} each</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Stepper onClick={() => setQty(l.product.id, l.qty - 1)}><Minus className="size-3.5" /></Stepper>
                  <input
                    value={l.qty}
                    onChange={(e) => setQty(l.product.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    className="tabular w-9 bg-transparent text-center text-sm outline-none"
                  />
                  <Stepper onClick={() => setQty(l.product.id, l.qty + 1)}><Plus className="size-3.5" /></Stepper>
                </div>
                <p className="tabular min-w-0 text-right text-sm font-medium text-slate-900">
                  {money(Number(l.product.sellingPrice) * l.qty)}
                </p>
                <button onClick={() => setQty(l.product.id, 0)} className="text-slate-300 hover:text-red-500">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Totals + payment */}
        <div className="mt-3 border-t border-hairline pt-3">
          {canDiscount && lines.length > 0 && (
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-500">Discount</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                className="tabular w-24 border-b border-hairline bg-transparent text-right outline-none focus:border-brand-600"
              />
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-slate-500">Total</span>
            <span className="tabular text-2xl font-semibold tracking-tight text-slate-900">{money(total)}</span>
          </div>

          {lines.length > 0 && (
            <div className="mt-3 space-y-2">
              {tenders.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={t.method}
                    onChange={(e) => setTenders((ts) => ts.map((x, j) => (j === i ? { ...x, method: e.target.value as PaymentMethod } : x)))}
                    className="h-10 rounded-lg border border-hairline bg-white px-2 text-sm outline-none focus:border-brand-600"
                  >
                    {METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <input
                    value={t.amount}
                    onChange={(e) => setTenders((ts) => ts.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                    inputMode="numeric"
                    placeholder="Amount"
                    className="tabular h-10 flex-1 rounded-lg border border-hairline bg-white px-3 text-right outline-none focus:border-brand-600"
                  />
                  {tenders.length > 1 && (
                    <button onClick={() => setTenders((ts) => ts.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => setTenders((ts) => [...ts, { method: 'MOBILE_MONEY', amount: '' }])}
                  className="text-brand-700 hover:text-brand-800"
                >
                  + Split payment
                </button>
                <button
                  onClick={() => setTenders((ts) => (ts.length ? ts.map((x, j) => (j === 0 ? { ...x, amount: String(total) } : x)) : ts))}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Exact
                </button>
              </div>

              {change > 0 && (
                <p className="flex justify-between text-sm text-slate-600">
                  <span>Change</span><span className="tabular">{money(change)}</span>
                </p>
              )}
              {due > 0 && (
                <div className="rounded-lg bg-amber-50 px-3 py-2">
                  <p className="flex justify-between text-sm text-amber-700">
                    <span>On credit</span><span className="tabular font-medium">{money(due)}</span>
                  </p>
                  <CustomerPicker token={token} customer={customer} onPick={setCustomer} />
                </div>
              )}

              {checkout.isError && (
                <p className="text-sm text-red-600">
                  {checkout.error instanceof ApiError ? checkout.error.message : 'Could not complete the sale.'}
                </p>
              )}

              <Button
                className="mt-1 w-full"
                loading={checkout.isPending}
                disabled={!canCheckout}
                onClick={() => checkout.mutate()}
              >
                {due > 0 ? `Charge ${money(paid)} + credit` : `Charge ${money(total)}`}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: floating bar that opens the cart sheet */}
      {lines.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 flex items-center justify-between rounded-xl bg-brand-600 px-5 py-3.5 text-white shadow-lg sm:inset-x-auto sm:right-6 sm:left-[92px] sm:bottom-6 lg:hidden"
        >
          <span className="flex items-center gap-2 font-medium">
            <ShoppingCart className="size-5" />
            {cartCount} item{cartCount === 1 ? '' : 's'}
          </span>
          <span className="tabular font-semibold">{money(total)} · Review &amp; pay</span>
        </button>
      )}

      {receipt && <Receipt sale={receipt} businessName={businessName} onNewSale={resetSale} />}
    </div>
  );
}

function Stepper({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md border border-hairline text-slate-500 hover:border-brand-600 hover:text-brand-700"
    >
      {children}
    </button>
  );
}

/** Minimal credit-customer picker: search existing or create a new one inline. */
function CustomerPicker({
  token,
  customer,
  onPick,
}: {
  token?: string;
  customer: Customer | null;
  onPick: (c: Customer | null) => void;
}) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const { data } = useQuery({
    queryKey: ['pos-customers', q],
    queryFn: () => api.get<{ data: Customer[] }>(`/customers?search=${encodeURIComponent(q)}&limit=6`, { accessToken: token }),
    enabled: !!token && open,
  });
  const create = useMutation({
    mutationFn: () => api.post<Customer>('/customers', { name: q.trim() }, { accessToken: token }),
    onSuccess: (c) => { onPick(c); setOpen(false); setQ(''); },
  });

  if (customer) {
    return (
      <p className="mt-1 flex items-center justify-between text-sm text-slate-700">
        <span>{customer.name}</span>
        <button onClick={() => onPick(null)} className="text-slate-400 hover:text-red-600">change</button>
      </p>
    );
  }

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1.5 border-b border-amber-200 py-1">
        <UserPlus className="size-4 text-amber-500" />
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Customer name…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-amber-400/70"
        />
      </div>
      {open && (
        <div className="mt-1 space-y-0.5">
          {(data?.data ?? []).map((c) => (
            <button key={c.id} onClick={() => { onPick(c); setOpen(false); }} className="block w-full truncate rounded px-1 py-1 text-left text-sm hover:bg-amber-100">
              {c.name} {c.phone && <span className="text-slate-400">· {c.phone}</span>}
            </button>
          ))}
          {q.trim() && !create.isPending && (
            <button onClick={() => create.mutate()} className="block w-full px-1 py-1 text-left text-sm font-medium text-brand-700 hover:bg-amber-100">
              + Create “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
