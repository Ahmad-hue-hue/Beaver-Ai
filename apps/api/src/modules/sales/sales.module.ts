import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';

@Module({
  imports: [InventoryModule, BillingModule], // reuse InventoryService.applyInTx; gate paid tender by plan
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
