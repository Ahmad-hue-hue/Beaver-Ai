import { describe, expect, it } from 'bun:test';
import { Prisma } from '@prisma/client';
import { ageLedger, totalOutstanding, type AgingRow } from './aging.js';

const D = Prisma.Decimal;
const asOf = new Date(2026, 0, 31);

/** ISO without time so day math is independent of TZ clock. */
const at = (iso: string): Date => new Date(`${iso}T12:00:00Z`);

function credit(amount: number | string, createdAt: Date): AgingRow {
  return { type: 'SALE_CREDIT', amount: new D(amount), createdAt };
}
function payment(amount: number | string, createdAt: Date): AgingRow {
  return { type: 'PAYMENT', amount: new D(amount).negated(), createdAt };
}

const D_60 = at('2025-10-01'); // ~122 days old
const D_40 = at('2025-12-15'); // ~47 days old
const D_10 = at('2026-01-15'); // ~16 days old
const D_NOW = at('2026-01-31'); // current

describe('ageLedger (FIFO)', () => {
  it('buckets a single current credit', () => {
    const b = ageLedger([credit(1000, D_NOW)], asOf);
    expect(b.current.toString()).toBe('1000');
    expect(totalOutstanding(b).toString()).toBe('1000');
  });

  it('ages a credit created more than 60 days ago', () => {
    const b = ageLedger([credit(1000, D_60)], asOf);
    expect(b.days60plus.toString()).toBe('1000');
  });

  it('splits credits of different ages into different buckets', () => {
    const rows = [
      credit(1000, D_60), // 60+
      credit(500, D_40), // 31-60
      credit(300, D_10), // 1-30
      credit(200, D_NOW), // current
    ];
    const b = ageLedger(rows, asOf);
    expect(b.days60plus.toString()).toBe('1000');
    expect(b.days31to60.toString()).toBe('500');
    expect(b.days1to30.toString()).toBe('300');
    expect(b.current.toString()).toBe('200');
    expect(totalOutstanding(b).toString()).toBe('2000');
  });

  it('applies payments to the oldest credit first (FIFO)', () => {
    const rows = [
      credit(1000, D_60), // oldest
      credit(500, D_NOW), // newest
      payment(600, at('2026-01-20')), // pays down the oldest credit first
    ];
    const b = ageLedger(rows, asOf);
    expect(b.days60plus.toString()).toBe('400');
    expect(b.current.toString()).toBe('500');
    expect(totalOutstanding(b).toString()).toBe('900');
  });

  it('returns zero buckets when everything is paid', () => {
    const b = ageLedger([credit(1000, D_60), payment(1000, at('2026-01-20'))], asOf);
    expect(totalOutstanding(b).toString()).toBe('0');
  });

  it('ignores fully-consumed credits after FIFO', () => {
    const b = ageLedger([credit(300, D_60), credit(700, D_NOW), payment(800, at('2026-01-20'))], asOf);
    expect(b.current.toString()).toBe('200');
    expect(b.days60plus.toString()).toBe('0');
    expect(totalOutstanding(b).toString()).toBe('200');
  });
});
