import { describe, expect, test } from 'bun:test';
import { PERMISSIONS } from '@beaver/shared';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { formatToolError } from '../ai.service.js';
import { AgentToolRegistry } from './registry.js';
import type { ProductsService } from '../../products/products.service.js';
import type { InventoryService } from '../../inventory/inventory.service.js';

/**
 * Product-ID round-trip regression tests.
 *
 * The assistant only ever sees tool *summaries*, so those summaries must carry
 * the exact database IDs — otherwise the model invents IDs (e.g. `prd_T0eUj`)
 * and adjust_stock / receive_stock fail with "Product not found."
 */

const PRODUCT = {
  id: 'cmtl9testproduct00000000001',
  name: 'Sweep Soda',
  sku: 'SWP-1',
  sellingPrice: '1200',
  costPrice: '800',
  stockQuantity: '100',
  reorderLevel: '10',
  trackInventory: true,
  unit: { abbreviation: 'pc' },
};

const ACTOR = {
  userId: 'u-1',
  businessId: 'b-1',
  role: 'OWNER',
  permissions: [PERMISSIONS.PRODUCTS_VIEW, PERMISSIONS.INVENTORY_ADJUST, PERMISSIONS.INVENTORY_RECEIVE],
  isPlatformAdmin: false,
} as AuthenticatedUser;

const CTX = { businessId: 'b-1', actor: ACTOR, meta: { userAgent: 'test', ip: undefined } };

function makeRegistry(opts: { adjustImpl?: (productId: string) => Promise<unknown> } = {}) {
  const adjustCalls: Array<{ productId: string; quantity: number }> = [];
  const productsStub = {
    list: async (_businessId: string, _query: unknown) => ({
      data: [PRODUCT],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    }),
    findOne: async (_businessId: string, _id: string) => PRODUCT,
  };
  const inventoryStub = {
    adjust: async (_businessId: string, _userId: string, dto: { productId: string; quantity: number }) => {
      adjustCalls.push({ productId: dto.productId, quantity: dto.quantity });
      if (opts.adjustImpl) return opts.adjustImpl(dto.productId);
      return { ok: true };
    },
    receive: async () => ({ ok: true }),
  };
  const empty = {};
  const registry = new AgentToolRegistry(
    empty as never,
    productsStub as unknown as ProductsService,
    empty as never,
    empty as never,
    empty as never,
    empty as never,
    empty as never,
    empty as never,
    empty as never,
    empty as never,
    empty as never,
    inventoryStub as unknown as InventoryService,
  );
  return { registry, adjustCalls };
}

const call = (name: string, args: Record<string, unknown>) => ({
  id: 'call-1',
  name,
  arguments: JSON.stringify(args),
});

describe('agent tool product-ID round-trip', () => {
  test('list_products output carries the exact database id', async () => {
    const { registry } = makeRegistry();
    const out = await registry.execute(call('list_products', { search: 'soda' }), CTX);
    expect(out.output).toContain(`[id: ${PRODUCT.id}]`);
    expect(out.output).toContain('Sweep Soda');
  });

  test('product_lookup output carries the exact database id', async () => {
    const { registry } = makeRegistry();
    const out = await registry.execute(call('product_lookup', { productId: PRODUCT.id }), CTX);
    expect(out.output).toContain(`[id: ${PRODUCT.id}]`);
  });

  test('an id copied from list output works verbatim in adjust_stock', async () => {
    const { registry, adjustCalls } = makeRegistry();
    const listed = await registry.execute(call('list_products', {}), CTX);
    const match = /\[id: ([^\]]+)\]/.exec(listed.output);
    expect(match).not.toBeNull();
    const copiedId = match?.[1] as string;
    expect(copiedId).toBe(PRODUCT.id);
    const res = await registry.execute(call('adjust_stock', { productId: copiedId, quantity: -2 }), CTX);
    expect(res.mutated).toBe(true);
    expect(adjustCalls).toHaveLength(1);
    expect(adjustCalls[0]?.productId).toBe(PRODUCT.id);
  });

  test('an invented id surfaces the lookup failure (model sees the error)', async () => {
    const { registry } = makeRegistry({
      adjustImpl: async () => {
        throw new Error('Product not found.');
      },
    });
    await expect(
      registry.execute(call('adjust_stock', { productId: 'prd_T0eUj', quantity: 1 }), CTX),
    ).rejects.toThrow('Product not found.');
  });
});

describe('formatToolError', () => {
  test('not-found errors gain a recovery hint pointing at list output', () => {
    const out = formatToolError('Product not found.');
    expect(out).toContain('Product not found.');
    expect(out).toContain('list_products');
    expect(out).toContain('[id: ...]');
  });

  test('unrelated errors pass through untouched', () => {
    expect(formatToolError('Payment exceeds the customer balance.')).toBe(
      'Payment exceeds the customer balance.',
    );
  });
});
