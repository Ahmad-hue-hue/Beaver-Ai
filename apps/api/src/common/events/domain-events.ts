/**
 * Domain events. Emitted by write-path services and consumed by cross-cutting concerns
 * (cache invalidation, notifications, audit, and the autonomous agentic layer) so modules
 * stay decoupled. Names are dot-namespaced for EventEmitter2 wildcard subscriptions.
 */
export const DomainEvents = {
  SaleCompleted: 'sale.completed',
  SaleReturned: 'sale.returned',
  SaleVoided: 'sale.voided',
  StockChanged: 'stock.changed',
  StockAdjusted: 'stock.adjusted',
  StockVarianceDetected: 'stock.variance_detected',
  PurchaseReceived: 'purchase.received',
  DebtChanged: 'debt.changed',
  ExpenseRecorded: 'expense.recorded',
  CashSessionClosed: 'cash.session_closed',
  ProductPriceChanged: 'product.price_changed',
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];

export interface DomainEventBase {
  businessId: string;
  actorUserId?: string;
  at: Date;
}

export interface SaleCompletedEvent extends DomainEventBase {
  saleId: string;
  total: string; // decimal string
  hasCredit: boolean;
}

export interface StockChangedEvent extends DomainEventBase {
  productId: string;
  movementType: string;
  delta: number;
}

export interface StockVarianceDetectedEvent extends DomainEventBase {
  productId: string;
  expected: number;
  actual: number;
  difference: number;
}

export interface DebtChangedEvent extends DomainEventBase {
  customerId: string;
  balance: string; // decimal string
}

/** Metrics a business event should invalidate in the analytics cache. */
export const EVENT_CACHE_INVALIDATION: Record<string, string[]> = {
  [DomainEvents.SaleCompleted]: ['dashboard', 'sales', 'profit', 'inventory', 'cash'],
  [DomainEvents.SaleReturned]: ['dashboard', 'sales', 'profit', 'inventory'],
  [DomainEvents.SaleVoided]: ['dashboard', 'sales', 'profit', 'inventory', 'cash'],
  [DomainEvents.StockChanged]: ['dashboard', 'inventory'],
  [DomainEvents.StockAdjusted]: ['dashboard', 'inventory'],
  [DomainEvents.PurchaseReceived]: ['dashboard', 'inventory', 'suppliers'],
  [DomainEvents.DebtChanged]: ['dashboard', 'debts', 'customers'],
  [DomainEvents.ExpenseRecorded]: ['dashboard', 'expenses', 'profit'],
  [DomainEvents.CashSessionClosed]: ['dashboard', 'cash'],
  [DomainEvents.ProductPriceChanged]: ['products', 'profit'],
};
