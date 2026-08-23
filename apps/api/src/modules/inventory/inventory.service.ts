import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type InventoryMovementType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { RequestMeta } from '../auth/auth.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DomainEvents } from '../../common/events/domain-events.js';
import { variance } from '../../common/inventory/stock.js';
import type {
  AdjustStockDto,
  CreateCountDto,
  ListMovementsQuery,
  ReceiveStockDto,
  WriteOffDto,
} from './dto.js';

const dec = (v: number | string | Prisma.Decimal): Prisma.Decimal => new Prisma.Decimal(String(v));

export interface MovementInput {
  businessId: string;
  productId: string;
  type: InventoryMovementType;
  signedQty: Prisma.Decimal;
  unitCost?: Prisma.Decimal | null;
  reason?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  userId?: string | null;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Atomically apply a signed stock delta and append a ledger row. Uses an atomic DB
   * `increment` so concurrent movements can't lose updates; balanceAfter is the post-update
   * value. Rolls back (throws) if the result would go negative and negative stock is off.
   */
  private async applyMovement(
    tx: Prisma.TransactionClient,
    input: MovementInput,
    allowNegative: boolean,
  ) {
    const product = await tx.product.findFirst({
      where: { id: input.productId, businessId: input.businessId, deletedAt: null },
      select: { id: true, isService: true, trackInventory: true },
    });
    if (!product) throw new NotFoundException('Product not found.');
    if (product.isService || !product.trackInventory) {
      throw new BadRequestException('This product does not track stock.');
    }

    const updated = await tx.product.update({
      where: { id: input.productId },
      data: { stockQuantity: { increment: input.signedQty } },
      select: { stockQuantity: true },
    });

    if (!allowNegative && updated.stockQuantity.lessThan(0)) {
      throw new BadRequestException('Insufficient stock for this operation.');
    }

    return tx.inventoryMovement.create({
      data: {
        businessId: input.businessId,
        productId: input.productId,
        type: input.type,
        quantity: input.signedQty,
        balanceAfter: updated.stockQuantity,
        unitCost: input.unitCost ?? null,
        reason: input.reason ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        userId: input.userId ?? null,
      },
    });
  }

  private async allowNegative(businessId: string): Promise<boolean> {
    const s = await this.prisma.businessSettings.findUnique({
      where: { businessId },
      select: { allowNegativeStock: true },
    });
    return s?.allowNegativeStock ?? false;
  }

  /**
   * Public entrypoint for other write-path services (e.g. Sales, Purchases) to apply a
   * signed stock movement inside their OWN transaction — keeps the sale/purchase and the
   * ledger row in one atomic commit. Same semantics as the internal mover.
   */
  applyInTx(tx: Prisma.TransactionClient, input: MovementInput, allowNegative: boolean) {
    return this.applyMovement(tx, input, allowNegative);
  }

  /** Whether this business permits stock to go negative (from BusinessSettings). */
  negativeStockAllowed(businessId: string): Promise<boolean> {
    return this.allowNegative(businessId);
  }

  // ─────────────────────────── Manual stock ops ───────────────────────────

  /** Positive stock-in not tied to a purchase document (e.g. found stock, correction). */
  async receive(businessId: string, userId: string, dto: ReceiveStockDto, meta: RequestMeta) {
    if (dto.quantity <= 0) throw new BadRequestException('Quantity must be greater than 0.');
    const movement = await this.prisma.$transaction((tx) =>
      this.applyMovement(
        tx,
        {
          businessId,
          productId: dto.productId,
          type: 'ADJUSTMENT',
          signedQty: dec(dto.quantity),
          unitCost: dto.unitCost !== undefined ? dec(dto.unitCost) : null,
          reason: dto.reason ?? 'Manual stock-in',
          sourceType: 'Adjustment',
          userId,
        },
        true,
      ),
    );
    await this.afterMovement(businessId, userId, movement, meta, 'inventory.receive');
    return movement;
  }

  /** Signed correction (+/-). */
  async adjust(businessId: string, userId: string, dto: AdjustStockDto, meta: RequestMeta) {
    if (dto.quantity === 0) throw new BadRequestException('Adjustment quantity cannot be 0.');
    const allowNeg = await this.allowNegative(businessId);
    const movement = await this.prisma.$transaction((tx) =>
      this.applyMovement(
        tx,
        {
          businessId,
          productId: dto.productId,
          type: 'ADJUSTMENT',
          signedQty: dec(dto.quantity),
          unitCost: dto.unitCost !== undefined ? dec(dto.unitCost) : null,
          reason: dto.reason ?? 'Manual adjustment',
          sourceType: 'Adjustment',
          userId,
        },
        allowNeg,
      ),
    );
    await this.afterMovement(businessId, userId, movement, meta, 'inventory.adjust');
    return movement;
  }

  /** Remove stock as damage/expiry/loss (always a decrease). */
  async writeOff(businessId: string, userId: string, dto: WriteOffDto, meta: RequestMeta) {
    if (dto.quantity <= 0) throw new BadRequestException('Quantity must be greater than 0.');
    const allowNeg = await this.allowNegative(businessId);
    const movement = await this.prisma.$transaction((tx) =>
      this.applyMovement(
        tx,
        {
          businessId,
          productId: dto.productId,
          type: dto.type,
          signedQty: dec(dto.quantity).negated(),
          reason: dto.reason ?? dto.type,
          sourceType: 'WriteOff',
          userId,
        },
        allowNeg,
      ),
    );
    await this.afterMovement(businessId, userId, movement, meta, 'inventory.write_off');
    return movement;
  }

  // ─────────────────────────── History ───────────────────────────

  async listMovements(businessId: string, q: ListMovementsQuery) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 50, 200);
    const where: Prisma.InventoryMovementWhereInput = {
      businessId,
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.type ? { type: q.type as InventoryMovementType } : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { product: { select: { id: true, name: true, sku: true } } },
      }),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  // ─────────────────────────── Stock counts ───────────────────────────

  async createCount(businessId: string, userId: string, dto: CreateCountDto, meta: RequestMeta) {
    const ids = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, businessId, deletedAt: null },
      select: { id: true, stockQuantity: true },
    });
    const stockById = new Map(products.map((p) => [p.id, p.stockQuantity]));
    const missing = ids.filter((id) => !stockById.has(id));
    if (missing.length) throw new BadRequestException(`Unknown product(s): ${missing.join(', ')}`);

    const reference = dto.reference?.trim() || (await this.nextCountReference(businessId));

    const count = await this.prisma.inventoryCount.create({
      data: {
        businessId,
        reference,
        notes: dto.notes ?? null,
        userId,
        status: 'DRAFT',
        items: {
          create: dto.items.map((i) => {
            const expected = stockById.get(i.productId)!;
            return {
              productId: i.productId,
              expectedQty: expected,
              countedQty: dec(i.countedQty),
              variance: variance(dec(i.countedQty), expected),
            };
          }),
        },
      },
      include: { items: { include: { product: { select: { name: true, sku: true } } } } },
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'inventory.count_create',
      entityType: 'InventoryCount',
      entityId: count.id,
      after: { reference, items: dto.items.length },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return count;
  }

  /** Apply the count: bring each product's stock to its counted value via COUNT movements. */
  async completeCount(businessId: string, userId: string, countId: string, meta: RequestMeta) {
    const count = await this.prisma.inventoryCount.findFirst({
      where: { id: countId, businessId },
      include: { items: true },
    });
    if (!count) throw new NotFoundException('Stock count not found.');
    if (count.status !== 'DRAFT') throw new BadRequestException('Only draft counts can be completed.');

    await this.prisma.$transaction(async (tx) => {
      for (const item of count.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQuantity: true, isService: true, trackInventory: true },
        });
        if (!product || product.isService || !product.trackInventory) continue;
        const delta = item.countedQty.minus(product.stockQuantity);
        if (delta.isZero()) continue;
        await this.applyMovement(
          tx,
          {
            businessId,
            productId: item.productId,
            type: 'COUNT',
            signedQty: delta,
            reason: `Stock count ${count.reference}`,
            sourceType: 'InventoryCount',
            sourceId: count.id,
            userId,
          },
          true, // a count is authoritative; allow it to set the true figure
        );
      }
      await tx.inventoryCount.update({
        where: { id: count.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'inventory.count_complete',
      entityType: 'InventoryCount',
      entityId: count.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    this.events.emit(DomainEvents.StockAdjusted, { businessId, source: 'count', countId: count.id });
    return this.getCount(businessId, count.id);
  }

  async listCounts(businessId: string) {
    return this.prisma.inventoryCount.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async getCount(businessId: string, id: string) {
    const count = await this.prisma.inventoryCount.findFirst({
      where: { id, businessId },
      include: { items: { include: { product: { select: { name: true, sku: true } } } } },
    });
    if (!count) throw new NotFoundException('Stock count not found.');
    return count;
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private async afterMovement(
    businessId: string,
    userId: string,
    movement: { id: string; productId: string; type: InventoryMovementType; quantity: Prisma.Decimal; balanceAfter: Prisma.Decimal },
    meta: RequestMeta,
    action: string,
  ) {
    await this.audit.record({
      businessId,
      userId,
      action,
      entityType: 'InventoryMovement',
      entityId: movement.id,
      after: { productId: movement.productId, type: movement.type, quantity: movement.quantity, balanceAfter: movement.balanceAfter },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    this.events.emit(DomainEvents.StockAdjusted, {
      businessId,
      productId: movement.productId,
      type: movement.type,
    });
  }

  private async nextCountReference(businessId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todayCount = await this.prisma.inventoryCount.count({
      where: { businessId, reference: { startsWith: `CNT-${today}` } },
    });
    return `CNT-${today}-${String(todayCount + 1).padStart(3, '0')}`;
  }
}
