import { describe, expect, it } from 'bun:test';
import {
  debtConcentrationSeverity,
  lowStockSeverity,
  rankLowStock,
  rankSlowMovers,
} from './agents.logic.js';

describe('lowStockSeverity', () => {
  it('is critical with many, warn with some, info with none', () => {
    expect(lowStockSeverity(5)).toBe('critical');
    expect(lowStockSeverity(2)).toBe('warn');
    expect(lowStockSeverity(0)).toBe('info');
  });
});

describe('rankLowStock', () => {
  it('orders by shortfall (how far below reorder), most urgent first', () => {
    const rows = rankLowStock([
      { productId: 'b', name: 'B', stockQuantity: '8', reorderLevel: '10' },
      { productId: 'a', name: 'A', stockQuantity: '1', reorderLevel: '10' },
      { productId: 'c', name: 'C', stockQuantity: '2', reorderLevel: '5' },
    ]);
    expect(rows.map((r) => r.name)).toEqual(['A', 'C', 'B']);
    expect(rows[0]!.shortfall).toBe('9');
  });

  it('caps results', () => {
    const rows = rankLowStock(
      [1, 2, 3, 4, 5, 6].map((n) => ({
        productId: String(n),
        name: `P${n}`,
        stockQuantity: '0',
        reorderLevel: String(n),
      })),
      3,
    );
    expect(rows).toHaveLength(3);
  });
});

describe('rankSlowMovers', () => {
  it('ranks by capital tied up (stock × cost)', () => {
    const rows = rankSlowMovers([
      { productId: 'l', name: 'Low', stockQuantity: '100', costPrice: '1' },
      { productId: 'h', name: 'High', stockQuantity: '10', costPrice: '100' },
    ]);
    expect(rows[0]!.tiedUp).toBe('1000');
    expect(rows[1]!.tiedUp).toBe('100');
  });
});

describe('debtConcentrationSeverity', () => {
  it('critical when one debtor holds 80%+ of all debt', () => {
    expect(debtConcentrationSeverity('1000000', '900000', 90)).toBe('critical');
  });
  it('warn from 50% share', () => {
    expect(debtConcentrationSeverity('1000000', '600000', 60)).toBe('warn');
  });
  it('no debt is not an alarm', () => {
    expect(debtConcentrationSeverity('0', '0', 0)).toBe('info');
  });
});
