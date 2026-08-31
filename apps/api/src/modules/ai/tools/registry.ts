import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@beaver/shared';
import type { Permission } from '@beaver/shared';
import { AnalyticsService } from '../../analytics/analytics.service.js';
import { ProductsService } from '../../products/products.service.js';
import { CustomersService } from '../../customers/customers.service.js';
import { SalesService } from '../../sales/sales.service.js';
import { PurchasesService } from '../../purchases/purchases.service.js';
import { ExpensesService } from '../../expenses/expenses.service.js';
import { CashService } from '../../cash/cash.service.js';
import { DebtsService } from '../../debts/debts.service.js';
import { SuppliersService } from '../../suppliers/suppliers.service.js';
import { CategoriesService } from '../../categories/categories.service.js';
import { InventoryService } from '../../inventory/inventory.service.js';
import { UnitsService } from '../../units/units.module.js';
import type { ToolDefinition, ToolCall } from '../../../common/ai/ai.provider.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { RequestMeta } from '../../auth/auth.service.js';

/** One entry in the registry — schema the model sees + the business-scoped handler. */
interface ToolEntry {
  def: ToolDefinition;
  permission: Permission;
  run(ctx: ToolContext, args: Record<string, unknown>): unknown;
}

interface ToolContext {
  businessId: string;
  actor: AuthenticatedUser;
  meta: RequestMeta;
}

export interface ToolOutcome {
  label: string;
  output: string;
  mutated: boolean;
}

const isMutating = (name: string) =>
  /create|record|sale|purchase|expense|receive|adjust|write_off|void|payment|open|close|supplier|category|unit|debt/.test(name);

const trunc = (s: string, n = 600): string => (s.length <= n ? s : `${s.slice(0, n)}\u2026`);

function schema(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): ToolDefinition {
  return { type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } };
}

const str = { type: 'string' };
const num = { type: 'number' };
const bool = { type: 'boolean' };

const asStr = (v: unknown): string | undefined =>
  v === undefined || v === null || v === '' ? undefined : String(v);
const asNum = (v: unknown): number | undefined =>
  v === undefined || v === null || v === '' ? undefined : Number(v);
/**
 * The authoritative registry of tools the assistant can call. Every handler is scoped to
 * `businessId` from the JWT (never the model) and gated by a permission. Handlers reuse the
 * domain services (and their atomic transactions) — the agent never touches raw Prisma.
 */
@Injectable()
export class AgentToolRegistry {
  private readonly tools: Record<string, ToolEntry>;

  constructor(
    analytics: AnalyticsService,
    products: ProductsService,
    customers: CustomersService,
    sales: SalesService,
    purchases: PurchasesService,
    expenses: ExpensesService,
    cash: CashService,
    debts: DebtsService,
    suppliers: SuppliersService,
    categories: CategoriesService,
    units: UnitsService,
    inventory: InventoryService,
  ) {
    const meta = (): RequestMeta => ({ userAgent: 'beaver-agent', ip: undefined });

    const t = (def: ToolDefinition, permission: Permission, run: ToolEntry['run']): ToolEntry => ({
      def,
      permission,
      run: (ctx, args) => run(ctx, args),
    });

    this.tools = {
      // ── Read / analytics ──
      get_overview: t(
        schema('get_overview', 'Get today’s key business numbers: sales count, revenue, gross profit, expenses, cash in hand, debt outstanding and stock value.', {}),
        PERMISSIONS.AI_ASSISTANT_USE,
        ({ businessId }) => analytics.overview(businessId),
      ),
      get_stats: t(
        schema('get_stats', 'Get profit & loss for a period. Period is one of: today, week, month.', { period: str }, []),
        PERMISSIONS.AI_ASSISTANT_USE,
        ({ businessId }, a) => analytics.stats(businessId, asStr(a.period) ?? 'today'),
      ),
      get_top_products: t(
        schema('get_top_products', 'Get the best-selling products by revenue.', { limit: num }, []),
        PERMISSIONS.AI_ASSISTANT_USE,
        ({ businessId }, a) => analytics.topProducts(businessId, asNum(a.limit)),
      ),
      get_debtors: t(
        schema('get_debtors', 'Get the customers who owe money (debt balance), highest first.', { limit: num }, []),
        PERMISSIONS.AI_ASSISTANT_USE,
        ({ businessId }, a) => analytics.debtors(businessId, asNum(a.limit)),
      ),
      get_debt_aging: t(
        schema('get_debt_aging', 'Get the debt aging report (how long balances have been outstanding).', {}),
        PERMISSIONS.AI_ASSISTANT_USE,
        ({ businessId }) => debts.aging(businessId),
      ),
      list_products: t(
        schema('list_products', 'Search products by name/SKU/barcode.', { search: str, limit: num }, []),
        PERMISSIONS.PRODUCTS_VIEW,
        ({ businessId }, a) => products.list(businessId, { search: asStr(a.search), limit: asNum(a.limit) }),
      ),
      product_lookup: t(
        schema('product_lookup', 'Get one product by ID (with stock, price, reorder level).', { productId: str }, ['productId']),
        PERMISSIONS.PRODUCTS_VIEW,
        ({ businessId }, a) => products.findOne(businessId, asStr(a.productId) as string),
      ),
      list_customers: t(
        schema('list_customers', 'Search customers by name or phone.', { search: str, limit: num }, []),
        PERMISSIONS.CUSTOMERS_VIEW,
        ({ businessId }, a) => customers.list(businessId, { search: asStr(a.search), limit: asNum(a.limit) }),
      ),
      customer_statement: t(
        schema('customer_statement', 'Get a customer’s balance and full debit/credit ledger.', { customerId: str }, ['customerId']),
        PERMISSIONS.DEBTS_VIEW,
        ({ businessId }, a) => debts.statement(businessId, asStr(a.customerId) as string),
      ),
      list_suppliers: t(
        schema('list_suppliers', 'Search suppliers by name or phone.', { search: str, limit: num }, []),
        PERMISSIONS.SUPPLIERS_VIEW,
        ({ businessId }, a) => suppliers.list(businessId, { search: asStr(a.search), limit: asNum(a.limit) }),
      ),
      list_categories: t(
        schema('list_categories', 'List product categories.', {}),
        PERMISSIONS.PRODUCTS_VIEW,
        ({ businessId }) => categories.list(businessId),
      ),

      // ── Write: catalogue / directory ──
      create_product: t(
        schema(
          'create_product',
          'Add a new product to the catalogue. Provide name, and as available: sellingPrice (TZS), costPrice, trackInventory, openingStock, reorderLevel, unitId or categoryId. Use list_categories and list_products first to pick valid ids.',
          { name: str, sellingPrice: num, costPrice: num, description: str, sku: str, barcode: str, categoryId: str, unitId: str, trackInventory: bool, openingStock: num, reorderLevel: num, reorderQuantity: num, isService: bool },
          ['name'],
        ),
        PERMISSIONS.PRODUCTS_MANAGE,
        (ctx, a) => products.create(ctx.businessId, ctx.actor.userId,
          { name: asStr(a.name) as string, sellingPrice: asNum(a.sellingPrice), costPrice: asNum(a.costPrice), description: asStr(a.description), sku: asStr(a.sku), barcode: asStr(a.barcode), categoryId: asStr(a.categoryId), unitId: asStr(a.unitId), trackInventory: a.trackInventory === undefined ? undefined : Boolean(a.trackInventory), openingStock: asNum(a.openingStock), reorderLevel: asNum(a.reorderLevel), reorderQuantity: asNum(a.reorderQuantity), isService: a.isService === undefined ? undefined : Boolean(a.isService) },
          meta()),
      ),
      update_product: t(
        schema(
          'update_product',
          'Update details of an existing product (name, prices, reorder level, category, etc). Does NOT change stock — use adjust_stock or receive_stock for that.',
          { productId: str, name: str, sellingPrice: num, costPrice: num, description: str, categoryId: str, unitId: str, reorderLevel: num },
          ['productId'],
        ),
        PERMISSIONS.PRODUCTS_MANAGE,
        (ctx, a) => products.update(ctx.businessId, ctx.actor.userId, asStr(a.productId) as string,
          { name: asStr(a.name), sellingPrice: asNum(a.sellingPrice), costPrice: asNum(a.costPrice), description: asStr(a.description), categoryId: asStr(a.categoryId) ?? null, unitId: asStr(a.unitId) ?? null, reorderLevel: asNum(a.reorderLevel) },
          meta()),
      ),
      create_customer: t(
        schema('create_customer', 'Add a new customer. Provide name; phone, email, creditLimit optional.', { name: str, phone: str, email: str, creditLimit: num }, ['name']),
        PERMISSIONS.CUSTOMERS_MANAGE,
        (ctx, a) => customers.create(ctx.businessId, ctx.actor.userId, { name: asStr(a.name) as string, phone: asStr(a.phone), email: asStr(a.email), creditLimit: asNum(a.creditLimit) }, meta()),
      ),
      create_supplier: t(
        schema('create_supplier', 'Add a new supplier. Provide name; phone, email, address, note optional.', { name: str, phone: str, email: str, address: str }, ['name']),
        PERMISSIONS.SUPPLIERS_MANAGE,
        (ctx, a) => suppliers.create(ctx.businessId, ctx.actor.userId, { name: asStr(a.name) as string, phone: asStr(a.phone), email: asStr(a.email), address: asStr(a.address) }, meta()),
      ),
      create_category: t(
        schema('create_category', 'Add a new product category.', { name: str }, ['name']),
        PERMISSIONS.PRODUCTS_MANAGE,
        ({ businessId }, a) => categories.create(businessId, { name: asStr(a.name) as string }),
      ),
      create_unit: t(
        schema('create_unit', 'Add a new unit of measure (e.g. kg, box, piece).', { name: str, abbreviation: str }, ['name', 'abbreviation']),
        PERMISSIONS.PRODUCTS_MANAGE,
        (ctx, a) => units.create(ctx.businessId, { name: asStr(a.name) as string, abbreviation: asStr(a.abbreviation) as string }),
      ),

      // ── Write: sales / POS ──
      record_sale: t(
        schema(
          'record_sale',
          'Ring up a sale. items is a list of {productId, quantity, unitPrice?}; payments is a list of {method, amount, reference?} with method one of CASH, MOBILE_MONEY, BANK, CARD, CREDIT. For a credit sale set the payment method CREDIT (customerId required). Confirm prices/amounts are sensible.',
          { items: { type: 'array', items: { type: 'object', properties: { productId: str, quantity: num, unitPrice: num }, required: ['productId', 'quantity'] } }, payments: { type: 'array', items: { type: 'object', properties: { method: str, amount: num, reference: str }, required: ['method', 'amount'] } }, customerId: str, note: str },
          ['items'],
        ),
        PERMISSIONS.SALES_CREATE,
        (ctx, a) => sales.create(ctx.businessId, ctx.actor,
          { items: (a.items as Array<Record<string, unknown>>).map((i) => ({ productId: asStr(i.productId) as string, quantity: Number(i.quantity), unitPrice: asNum(i.unitPrice), discount: asNum(i.discount) })), payments: (a.payments as Array<Record<string, unknown>> | undefined)?.map((p) => ({ method: asStr(p.method) as 'CASH', amount: asNum(p.amount) as number, reference: asStr(p.reference) })), customerId: asStr(a.customerId), note: asStr(a.note) },
          meta()),
      ),
      void_sale: t(
        schema('void_sale', 'Void/cancel a completed sale (restocks items, reverses credit). Use only for mistaken sales.', { saleId: str }, ['saleId']),
        PERMISSIONS.SALES_CANCEL,
        (ctx, a) => sales.void(ctx.businessId, ctx.actor, asStr(a.saleId) as string, meta()),
      ),
      list_sales: t(
        schema('list_sales', 'List recent sales.', { period: str, limit: num }, []),
        PERMISSIONS.SALES_VIEW,
        ({ businessId }, a) => sales.list(businessId, { period: a.period as never, limit: asNum(a.limit) }),
      ),

      // ── Write: purchases & inventory ──
      record_purchase: t(
        schema(
          'record_purchase',
          'Create a purchase order (DRAFT) — does not add stock until receive_purchase is called. items is [{productId, quantity, unitCost}].',
          { supplierId: str, items: { type: 'array', items: { type: 'object', properties: { productId: str, quantity: num, unitCost: num }, required: ['productId', 'quantity', 'unitCost'] } }, note: str },
          ['supplierId', 'items'],
        ),
        PERMISSIONS.PURCHASES_MANAGE,
        (ctx, a) => purchases.create(ctx.businessId, ctx.actor.userId,
          { supplierId: asStr(a.supplierId) as string, note: asStr(a.note), items: (a.items as Array<Record<string, unknown>>).map((i) => ({ productId: asStr(i.productId) as string, quantity: Number(i.quantity), unitCost: asNum(i.unitCost) as number })) },
          meta()),
      ),
      receive_purchase: t(
        schema('receive_purchase', 'Receive goods from a purchase order: adds stock and updates cost. Call after record_purchase.', { purchaseId: str }, ['purchaseId']),
        PERMISSIONS.PURCHASES_MANAGE,
        (ctx, a) => purchases.receive(ctx.businessId, ctx.actor.userId, asStr(a.purchaseId) as string, meta()),
      ),
      receive_stock: t(
        schema('receive_stock', 'Manually add stock to a product (stock-in, not purchase-linked).', { productId: str, quantity: num, unitCost: num }, ['productId', 'quantity']),
        PERMISSIONS.INVENTORY_RECEIVE,
        (ctx, a) => inventory.receive(ctx.businessId, ctx.actor.userId, { productId: asStr(a.productId) as string, quantity: asNum(a.quantity) as number, unitCost: asNum(a.unitCost) }, meta()),
      ),
      adjust_stock: t(
        schema('adjust_stock', 'Correct a product’s stock by a signed quantity (positive adds, negative removes).', { productId: str, quantity: num, reason: str }, ['productId', 'quantity']),
        PERMISSIONS.INVENTORY_ADJUST,
        (ctx, a) => inventory.adjust(ctx.businessId, ctx.actor.userId, { productId: asStr(a.productId) as string, quantity: asNum(a.quantity) as number, reason: asStr(a.reason) }, meta()),
      ),
      write_off_stock: t(
        schema('write_off_stock', 'Remove damaged/expired/lost stock. type is one of DAMAGE, EXPIRY, LOSS.', { productId: str, quantity: num, type: str, reason: str }, ['productId', 'quantity', 'type']),
        PERMISSIONS.INVENTORY_ADJUST,
        (ctx, a) => inventory.writeOff(ctx.businessId, ctx.actor.userId, { productId: asStr(a.productId) as string, quantity: asNum(a.quantity) as number, type: asStr(a.type) as 'DAMAGE', reason: asStr(a.reason) }, meta()),
      ),

      // ── Write: expenses, debt, cash ──
      record_expense: t(
        schema('record_expense', 'Record a business expense. category is one of RENT, UTILITIES, SALARY, TRANSPORT, MARKETING, MAINTENANCE, OTHER; method one of CASH, MOBILE_MONEY, BANK, CARD.', { category: str, amount: num, method: str, payee: str, note: str }, ['category', 'amount']),
        PERMISSIONS.EXPENSES_MANAGE,
        (ctx, a) => expenses.create(ctx.businessId, ctx.actor.userId, { category: asStr(a.category) as 'RENT', amount: asNum(a.amount) as number, method: asStr(a.method), payee: asStr(a.payee), note: asStr(a.note) }, meta()),
      ),
      record_debt_payment: t(
        schema('record_debt_payment', 'Record a debt payment from a customer (reduces their balance). amount is what they paid.', { customerId: str, amount: num, method: str, note: str }, ['customerId', 'amount']),
        PERMISSIONS.DEBTS_MANAGE,
        (ctx, a) => debts.recordPayment(ctx.businessId, ctx.actor.userId, asStr(a.customerId) as string, { amount: asNum(a.amount) as number, method: asStr(a.method) as never, note: asStr(a.note) }, meta()),
      ),
    };
  }

  definitions(): ToolDefinition[] {
    return Object.values(this.tools).map((t) => t.def);
  }

  names(): string[] {
    return Object.keys(this.tools);
  }

  has(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.tools, name);
  }

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolOutcome> {
    const entry = this.tools[call.name];
    if (!entry) throw new Error(`Unknown tool: ${call.name}`);
    if (ctx.actor.permissions.includes(entry.permission) || ctx.actor.isPlatformAdmin === true) {
      // ok
    } else {
      throw new Error(
        `You don't have permission to run "${call.name}". Ask your shop owner to grant it, or request a different action.`,
      );
    }
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.arguments || '{}');
    } catch {
      throw new Error(`Malformed arguments for ${call.name}.`);
    }
    const result = await entry.run(ctx, args);
    const label = call.name.replace(/_/g, ' ');
    let output: string;
    if (typeof result === 'string') output = result;
    else output = JSON.stringify(result ?? null);
    return { label, output: trunc(output), mutated: isMutating(call.name) };
  }
}
