import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService } from '../cache/cache.service.js';
import {
  DomainEvents,
  EVENT_CACHE_INVALIDATION,
  type DomainEventBase,
} from './domain-events.js';

/**
 * Invalidates the analytics/dashboard cache metrics affected by each domain event — so
 * cached reads stay fast but never stale after a write. Handlers are explicit (no wildcard)
 * for reliability.
 */
@Injectable()
export class CacheInvalidationListener {
  constructor(private readonly cache: CacheService) {}

  private async invalidate(eventName: string, payload: DomainEventBase): Promise<void> {
    if (!payload?.businessId) return;
    const metrics = EVENT_CACHE_INVALIDATION[eventName] ?? [];
    if (metrics.length === 0) {
      await this.cache.invalidateBusiness(payload.businessId);
      return;
    }
    await Promise.all(metrics.map((m) => this.cache.invalidateBusiness(payload.businessId, m)));
  }

  @OnEvent(DomainEvents.SaleCompleted)
  onSaleCompleted(p: DomainEventBase) { return this.invalidate(DomainEvents.SaleCompleted, p); }

  @OnEvent(DomainEvents.SaleReturned)
  onSaleReturned(p: DomainEventBase) { return this.invalidate(DomainEvents.SaleReturned, p); }

  @OnEvent(DomainEvents.StockChanged)
  onStockChanged(p: DomainEventBase) { return this.invalidate(DomainEvents.StockChanged, p); }

  @OnEvent(DomainEvents.StockAdjusted)
  onStockAdjusted(p: DomainEventBase) { return this.invalidate(DomainEvents.StockAdjusted, p); }

  @OnEvent(DomainEvents.PurchaseReceived)
  onPurchaseReceived(p: DomainEventBase) { return this.invalidate(DomainEvents.PurchaseReceived, p); }

  @OnEvent(DomainEvents.DebtChanged)
  onDebtChanged(p: DomainEventBase) { return this.invalidate(DomainEvents.DebtChanged, p); }

  @OnEvent(DomainEvents.ExpenseRecorded)
  onExpenseRecorded(p: DomainEventBase) { return this.invalidate(DomainEvents.ExpenseRecorded, p); }

  @OnEvent(DomainEvents.CashSessionClosed)
  onCashSessionClosed(p: DomainEventBase) { return this.invalidate(DomainEvents.CashSessionClosed, p); }

  @OnEvent(DomainEvents.ProductPriceChanged)
  onProductPriceChanged(p: DomainEventBase) { return this.invalidate(DomainEvents.ProductPriceChanged, p); }
}
