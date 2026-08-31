import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { ProductsModule } from '../products/products.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { PurchasesModule } from '../purchases/purchases.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { CashModule } from '../cash/cash.module.js';
import { DebtsModule } from '../debts/debts.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { UnitsModule } from '../units/units.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AgentsService } from './agents.service.js';
import { AgentToolRegistry } from './tools/registry.js';

@Module({
  imports: [
    AnalyticsModule,
    ProductsModule,
    CustomersModule,
    SalesModule,
    PurchasesModule,
    ExpensesModule,
    CashModule,
    DebtsModule,
    SuppliersModule,
    CategoriesModule,
    InventoryModule,
    UnitsModule,
  ],
  controllers: [AiController],
  providers: [AiService, AgentsService, AgentToolRegistry],
  exports: [AiService, AgentsService],
})
export class AiModule {}
