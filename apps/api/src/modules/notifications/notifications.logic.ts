import { Prisma } from '@prisma/client';

/**
 * Deterministic message/severity construction for generated notifications. Purely from a small
 * set of signals (counts, totals) — no I/O. Kept separate from the service so the branching,
 * pluralisation, formatting and severity rules are unit-testable.
 */

const D = Prisma.Decimal;

export type Severity = 'info' | 'warn' | 'critical';

/** Format a money total as a short display string, e.g. `TZS 125000`. */
export function fmtMoney(v: Prisma.Decimal | string | number): string {
  const amount = new D(String(v)).toDecimalPlaces(0);
  return `TZS ${amount.toString()}`;
}

export interface LowStockSignal {
  count: number;
  names: string[]; // up to the capped number actually surfaced
}

export interface LowStockMessage {
  severity: Severity;
  title: string;
  body: string;
}

/**
 * Low-stock title/severity. A single item names it directly; 5+ items escalates to `critical`.
 * Names are joined for the body text.
 */
export function lowStockMessage(signal: LowStockSignal): LowStockMessage {
  if (signal.names.length === 0) {
    return { severity: 'info', title: 'No low-stock items', body: '' };
  }
  const title =
    signal.count === 1
      ? `Out of stock: ${signal.names[0]}`
      : `${signal.count} products need restocking`;
  const body = `Running low: ${signal.names.join(', ')}. Reorder before you run out.`;
  return { severity: signal.count >= 5 ? 'critical' : 'warn', title, body };
}

export interface DebtMessage {
  severity: Severity;
  title: string;
  body: string;
}

/** Debt notification for a total owed across `count` accounts. */
export function debtMessage(total: Prisma.Decimal | string | number, count: number): DebtMessage {
  return {
    severity: 'warn',
    title: `Customers owe ${fmtMoney(total)}`,
    body: `${count} account${count === 1 ? '' : 's'} with an open balance. Chasing debt keeps cash flowing.`,
  };
}

export interface DailySummarySignal {
  revenue: Prisma.Decimal | string | number;
  expenses: Prisma.Decimal | string | number;
  saleCount: number;
}

export interface DailySummaryMessage {
  severity: Severity | null; // null → skip (nothing happened today)
  title: string;
  body: string;
}

/**
 * Daily sales summary. Returns `severity: null` when there were no sales and no expenses today
 * (nothing worth reporting). Otherwise info for a revenue day, warn for an expenses-only day.
 */
export function dailySummaryMessage(signal: DailySummarySignal): DailySummaryMessage {
  const revenue = new D(String(signal.revenue));
  const expenses = new D(String(signal.expenses));
  if (revenue.lessThanOrEqualTo(0) && expenses.lessThanOrEqualTo(0)) {
    return { severity: null, title: '', body: '' };
  }
  return {
    severity: revenue.greaterThan(0) ? 'info' : 'warn',
    title: `Daily summary — ${fmtMoney(revenue)} in sales`,
    body: `${signal.saleCount} sale${signal.saleCount === 1 ? '' : 's'} today. Expenses: ${fmtMoney(expenses)}.`,
  };
}
