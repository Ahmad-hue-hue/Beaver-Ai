import { describe, expect, it } from 'bun:test';
import {
  dailySummaryMessage,
  debtMessage,
  fmtMoney,
  lowStockMessage,
} from './notifications.logic.js';

describe('fmtMoney', () => {
  it('formats as TZS with no decimals', () => {
    expect(fmtMoney('125000.99')).toBe('TZS 125001'); // rounds to whole
    expect(fmtMoney('6500')).toBe('TZS 6500');
    expect(fmtMoney(0)).toBe('TZS 0');
  });
});

describe('lowStockMessage', () => {
  it('names a single item directly', () => {
    const m = lowStockMessage({ count: 1, names: ['Bottled water 1.5L'] });
    expect(m.severity).toBe('warn');
    expect(m.title).toBe('Out of stock: Bottled water 1.5L');
    expect(m.body).toContain('Bottled water 1.5L');
  });

  it('summarises multiple items', () => {
    const m = lowStockMessage({ count: 3, names: ['Rice', 'Sugar', 'Oil'] });
    expect(m.severity).toBe('warn');
    expect(m.title).toBe('3 products need restocking');
    expect(m.body).toBe('Running low: Rice, Sugar, Oil. Reorder before you run out.');
  });

  it('escalates to critical at 5+ items', () => {
    const names = ['a', 'b', 'c', 'd', 'e'];
    expect(lowStockMessage({ count: 5, names }).severity).toBe('critical');
    expect(lowStockMessage({ count: 6, names }).severity).toBe('critical');
    expect(lowStockMessage({ count: 4, names: ['a', 'b', 'c', 'd'] }).severity).toBe('warn');
  });

  it('returns an info no-op for an empty signal', () => {
    const m = lowStockMessage({ count: 0, names: [] });
    expect(m.severity).toBe('info');
  });
});

describe('debtMessage', () => {
  it('names the total owed', () => {
    const m = debtMessage('6500', 1);
    expect(m.title).toBe('Customers owe TZS 6500');
  });

  it('pluralises accounts correctly', () => {
    expect(debtMessage('6500', 1).body).toContain('1 account with');
    expect(debtMessage('6500', 3).body).toContain('3 accounts with');
  });
});

describe('dailySummaryMessage', () => {
  it('skips when there were no sales and no expenses', () => {
    expect(dailySummaryMessage({ revenue: 0, expenses: 0, saleCount: 0 }).severity).toBeNull();
  });

  it('is info on a revenue day', () => {
    const m = dailySummaryMessage({ revenue: '125000', expenses: '25000', saleCount: 7 });
    expect(m.severity).toBe('info');
    expect(m.title).toBe('Daily summary — TZS 125000 in sales');
    expect(m.body).toContain('7 sales today');
    expect(m.body).toContain('Expenses: TZS 25000.');
  });

  it('is warn on an expenses-only day', () => {
    const m = dailySummaryMessage({ revenue: 0, expenses: '25000', saleCount: 0 });
    expect(m.severity).toBe('warn');
    expect(m.body).toContain('0 sales today');
  });

  it('pluralises a single sale', () => {
    const m = dailySummaryMessage({ revenue: '1000', expenses: 0, saleCount: 1 });
    expect(m.body).toContain('1 sale today');
  });
});
