import { describe, expect, it } from 'bun:test';
import { planReturns, refundTotal, ReturnValidationError } from './refund.js';

const line = (over: Partial<Parameters<typeof planReturns>[0][number]> = {}) => ({
  saleItemId: 'item-1',
  name: 'Coca-Cola 500ml',
  lineTotal: '25000',
  quantity: '10',
  alreadyReturned: '0',
  returnQty: '2',
  ...over,
});

describe('planReturns', () => {
  it('refunds proportionally to what was charged (incl. tax/discount)', () => {
    // line charged 25000 for 10 units → 2500/unit; returning 2 → 5000
    const [p] = planReturns([line()]);
    expect(p!.refundAmount.toString()).toBe('5000');
    expect(p!.quantity.toString()).toBe('2');
  });

  it('rounds refund money to 2 dp half-up', () => {
    // 3 units charged 1000 total → 333.333../unit; returning 1 → 333.33
    const [p] = planReturns([line({ lineTotal: '1000', quantity: '3', returnQty: '1' })]);
    expect(p!.refundAmount.toString()).toBe('333.33');
  });

  it('computes remaining as sold minus already returned', () => {
    const [p] = planReturns([line({ quantity: '10', alreadyReturned: '4', returnQty: '2' })]);
    expect(p!.remaining.toString()).toBe('6');
  });

  it('handles a full remaining-quantity return', () => {
    const [p] = planReturns([line({ quantity: '10', alreadyReturned: '0', returnQty: '10' })]);
    expect(p!.refundAmount.toString()).toBe('25000');
  });

  it('rejects over-return with the line name and remaining in the message', () => {
    expect(() => planReturns([line({ quantity: '10', alreadyReturned: '8', returnQty: '3' })])).toThrow(
      ReturnValidationError,
    );
    try {
      planReturns([line({ quantity: '10', alreadyReturned: '8', returnQty: '3' })]);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('Coca-Cola 500ml');
      expect((e as Error).message).toContain('2 remaining.');
    }
  });

  it('rejects a zero-returning negative quantity gracefully', () => {
    expect(() => planReturns([line({ returnQty: '-1' })])).toThrow(ReturnValidationError);
  });

  it('handles fractional unit quantities (kg)', () => {
    const [p] = planReturns([
      line({ name: 'Rice 1kg', lineTotal: '3200', quantity: '1.5', alreadyReturned: '0', returnQty: '0.5' }),
    ]);
    expect(p!.refundAmount.toString()).toBe('1066.67');
  });

  it('plans multiple lines independently', () => {
    const planned = planReturns([
      line({ saleItemId: 'a', lineTotal: '10000', quantity: '10', returnQty: '5' }),
      line({ saleItemId: 'b', lineTotal: '6000', quantity: '2', returnQty: '1' }),
    ]);
    expect(planned).toHaveLength(2);
    expect(planned[0]!.refundAmount.toString()).toBe('5000');
    expect(planned[1]!.refundAmount.toString()).toBe('3000');
  });

  it('rejects a zero return quantity', () => {
    expect(() => planReturns([line({ returnQty: '0' })])).toThrow(ReturnValidationError);
  });
});

describe('refundTotal', () => {
  it('sums planned refunds and rounds to 2 dp', () => {
    const planned = planReturns([
      line({ saleItemId: 'a', lineTotal: '1000', quantity: '3', returnQty: '1' }),
      line({ saleItemId: 'b', lineTotal: '1000', quantity: '3', returnQty: '1' }),
    ]);
    expect(refundTotal(planned).toString()).toBe('666.66');
  });

  it('is zero for an empty plan', () => {
    expect(refundTotal([]).toString()).toBe('0');
  });
});
