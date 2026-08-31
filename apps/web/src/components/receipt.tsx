'use client';

import * as React from 'react';
import { Check, Printer, Plus } from '@/components/ui/icon';
import { formatMoney } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export interface ReceiptSale {
  id: string;
  reference: string;
  soldAt?: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  paidTotal: string;
  changeGiven: string;
  balanceDue: string;
  customer?: { name: string } | null;
  items: {
    id: string;
    nameSnapshot: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }[];
  payments: { method: string; amount: string }[];
}

const money = (v: string | number) => formatMoney(Number(v), { currency: 'TZS', symbolless: true });
const METHOD_KEY: Record<string, string> = {
  CASH: 'receipt.method.cash',
  MOBILE_MONEY: 'receipt.method.mobile',
  BANK: 'receipt.method.bank',
  CARD: 'receipt.method.card',
  CREDIT: 'receipt.method.credit',
};

/** Post-sale confirmation + printable receipt. Print CSS isolates #receipt on paper. */
export function Receipt({
  sale,
  businessName,
  onNewSale,
}: {
  sale: ReceiptSale;
  businessName: string;
  onNewSale: () => void;
}) {
  const credit = Number(sale.balanceDue) > 0;
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`@media print { body * { visibility: hidden !important; } #receipt, #receipt * { visibility: visible !important; } #receipt { position: absolute; inset: 0; margin: 0 auto; box-shadow: none !important; } .no-print { display: none !important; } }`}</style>

      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="no-print mb-5 flex items-center gap-2 text-brand-700">
          <span className="grid size-8 place-items-center rounded-full bg-brand-50">
            <Check className="size-5" strokeWidth={2.5} />
          </span>
          <p className="font-medium">{t('receipt.completed')}</p>
        </div>

        <div id="receipt" className="font-mono text-[13px] leading-relaxed text-slate-800">
          <div className="text-center">
            <p className="text-base font-semibold tracking-tight">{businessName}</p>
            <p className="text-slate-500">{sale.reference}</p>
            <p className="text-slate-400">
              {sale.soldAt ? new Date(sale.soldAt).toLocaleString('en-GB') : ''}
            </p>
          </div>

          <div className="my-3 border-t border-dashed border-slate-300" />

          {sale.items.map((it) => (
            <div key={it.id} className="mb-1.5">
              <p className="truncate">{it.nameSnapshot}</p>
              <div className="flex justify-between text-slate-500">
                <span>{Number(it.quantity)} × {money(it.unitPrice)}</span>
                <span className="tabular text-slate-800">{money(it.lineTotal)}</span>
              </div>
            </div>
          ))}

          <div className="my-3 border-t border-dashed border-slate-300" />

          <Row label={t('receipt.subtotal')} value={money(sale.subtotal)} />
          {Number(sale.discountTotal) > 0 && <Row label={t('receipt.discount')} value={`- ${money(sale.discountTotal)}`} />}
          {Number(sale.taxTotal) > 0 && <Row label={t('receipt.tax')} value={money(sale.taxTotal)} />}
          <div className="mt-1 flex justify-between text-[15px] font-semibold">
            <span>{t('receipt.total')}</span>
            <span className="tabular">{money(sale.total)}</span>
          </div>

          <div className="my-3 border-t border-dashed border-slate-300" />

          {sale.payments.map((p, i) => (
            <Row key={i} label={t(METHOD_KEY[p.method] ?? p.method)} value={money(p.amount)} />
          ))}
          {Number(sale.changeGiven) > 0 && <Row label={t('receipt.change')} value={money(sale.changeGiven)} />}
          {credit && (
            <Row
              label={`${t('receipt.credit')}${sale.customer ? ` · ${sale.customer.name}` : ''}`}
              value={money(sale.balanceDue)}
            />
          )}

          <p className="mt-4 text-center text-slate-400">{t('receipt.thanks')}</p>
        </div>

        <div className="no-print mt-6 flex gap-2">
          <Button variant="subtle" size="sm" className="flex-1" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
          <Button size="sm" className="flex-1" onClick={onNewSale}>
            <Plus className="size-4" strokeWidth={2.5} /> New sale
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
