import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { configuration } from './config/configuration.js';
import { CacheModule } from './common/cache/cache.module.js';
import { EventsModule } from './common/events/events.module.js';
import { AiModule as CommonAiModule } from './common/ai/ai.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { AuditModule } from './common/audit/audit.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BusinessesModule } from './modules/businesses/businesses.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { UnitsModule } from './modules/units/units.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';
import { PurchasesModule } from './modules/purchases/purchases.module.js';
import { ExpensesModule } from './modules/expenses/expenses.module.js';
import { CashModule } from './modules/cash/cash.module.js';
import { DebtsModule } from './modules/debts/debts.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { MembersModule } from './modules/members/members.module.js';
import { BillingModule } from './modules/billing/billing.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], cache: true }),
    EventEmitterModule.forRoot({ wildcard: false, maxListeners: 50 }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    PrismaModule,
    CacheModule,
    EventsModule,
    CommonAiModule,
    AuditModule,
    AuthModule,
    HealthModule,
    BusinessesModule,
    CategoriesModule,
    UnitsModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    SalesModule,
    SuppliersModule,
    PurchasesModule,
    ExpensesModule,
    CashModule,
    DebtsModule,
    AnalyticsModule,
    AiModule,
    NotificationsModule,
    MembersModule,
    BillingModule,
  ],
})
export class AppModule {}
