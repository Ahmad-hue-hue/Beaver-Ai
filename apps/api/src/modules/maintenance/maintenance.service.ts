import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

const BATCH = 5_000;

/**
 * Periodic deletion of unbounded-growth table history (AuditLog, InventoryMovement).
 *
 * Retention is opt-in via env (0 days disables that table). Rows are removed in bounded
 * id-batches so a large backlog never holds a single long-lived transaction or lock.
 * Runs in-process, which is safe for the single-host deployment; a multi-replica
 * deployment would move this to a cron/queue worker instead.
 */
@Injectable()
export class MaintenanceService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Maintenance');
  private readonly auditDays: number;
  private readonly movementDays: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private firstRun: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const retention = config.get<AppConfig['retention']>('retention')!;
    this.auditDays = retention.auditDays;
    this.movementDays = retention.movementDays;
  }

  onApplicationBootstrap() {
    // First sweep shortly after boot, then every 6 hours. Cheap no-op when disabled.
    const run = () => void this.sweep();
    this.firstRun = setTimeout(run, 10 * 60_000);
    this.timer = setInterval(run, 6 * 60 * 60_000);
    this.firstRun.unref?.();
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.firstRun) clearTimeout(this.firstRun);
    this.timer = null;
    this.firstRun = null;
  }

  private async sweep() {
    try {
      if (this.auditDays > 0) await this.deleteAuditOlderThan(this.auditDays);
      if (this.movementDays > 0) await this.deleteMovementOlderThan(this.movementDays);
    } catch (err) {
      this.logger.error(`retention sweep failed: ${(err as Error)?.message}`);
    }
  }

  private async deleteAuditOlderThan(days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let removed = 0;
    for (;;) {
      const rows = await this.prisma.auditLog.findMany({
        select: { id: true },
        where: { createdAt: { lt: cutoff } },
        take: BATCH,
      });
      if (rows.length === 0) break;
      const ids = rows.map((r) => r.id);
      const { count } = await this.prisma.auditLog.deleteMany({ where: { id: { in: ids } } });
      removed += count;
      if (rows.length < BATCH) break;
    }
    if (removed > 0) this.logger.log(`retention: removed ${removed} AuditLog(s) older than ${days}d`);
  }

  private async deleteMovementOlderThan(days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let removed = 0;
    for (;;) {
      const rows = await this.prisma.inventoryMovement.findMany({
        select: { id: true },
        where: { createdAt: { lt: cutoff } },
        take: BATCH,
      });
      if (rows.length === 0) break;
      const ids = rows.map((r) => r.id);
      const { count } = await this.prisma.inventoryMovement.deleteMany({ where: { id: { in: ids } } });
      removed += count;
      if (rows.length < BATCH) break;
    }
    if (removed > 0) this.logger.log(`retention: removed ${removed} InventoryMovement(s) older than ${days}d`);
  }
}