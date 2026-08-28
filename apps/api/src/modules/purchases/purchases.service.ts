import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { RequestMeta } from '../auth/auth.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DomainEvents } from '../../common/events/domain-events.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CreatePurchaseDto, ListPurchasesQuery } from './dto.js';
import { purchaseTotals, purchasePaymentSplit, weightedAverageCost } from './totals.js';

const dec = (v: number | string | Prisma.Decimal): Prisma.Decimal => new Prisma.Decimal(String(v));

const purchaseDetail = {
  items: true,
  supplier: { select: { id: true, name: true } },
  receipt: true,
} satisfies Prisma.PurchaseInclude;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ─────────────────────────── Create ───────────────────────────

  async create(businessId: string, userId: string, dto: CreatePurchaseDto, meta: RequestMeta) {
    if (!dto.items.length) throw new BadRequestException('A purchase needs at least one item.');

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, businessId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!supplier) throw new BadRequestException('Selected supplier does not exist.');

    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, businessId, deletedAt: null },
      select: { id: true, name: true, isService: true, trackInventory: true, costPrice: true, stockQuantity: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) throw new BadRequestException(`Unknown product(s): ${missing.join(', ')}`);

    const lines = dto.items.map((input) => {
      const product = byId.get(input.productId)!;
      return { product, input: { ...input, taxRate: input.taxRate ?? 0 }, unitCost: dec(input.unitCost) };
    });

    const totals = purchaseTotals(
      lines.map((l) => ({
        unitCost: l.unitCost,
        quantity: l.input.quantity,
        discount: l.input.discount ?? 0,
        taxRate: l.input.taxRate ?? 0,
      })),
      dto.discount ?? 0,
    );

    const split = purchasePaymentSplit(totals.total, [dto.paidAmount ?? 0]);

    const reference = await this.nextPurchaseReference(businessId);
    const purchase = await this.prisma.$transaction(async (tx) => {
      return tx.purchase.create({
        data: {
          businessId,
          reference,
          supplierId: supplier.id,
          supplierName: supplier.name,
          status: 'DRAFT',
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          paidTotal: split.paidTotal,
          balanceDue: split.balanceDue,
          note: dto.note?.trim() || null,
          items: {
            create: lines.map((l, idx) => ({
              businessId,
              productId: l.product.id,
              nameSnapshot: l.product.name,
              quantity: dec(l.input.quantity),
              unitCost: l.unitCost,
              discount: totals.lines[idx]!.discount,
              taxRate: dec(l.input.taxRate ?? 0),
              lineTotal: totals.lines[idx]!.lineTotal,
            })),
          },
        },
        include: purchaseDetail,
      });
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'purchase.create',
      entityType: 'Purchase',
      entityId: purchase.id,
      after: { reference, supplier: supplier.name, total: totals.total.toString(), balanceDue: split.balanceDue.toString() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return purchase;
  }

  // ─────────────────────────── Receive (goods received) ───────────────────────────

  /**
   * Goods-received: atomically raise stock, update weighted-average costs, create the GRN and
   * mark the purchase RECEIVED. Single receive per purchase. Under-paid purchases leave a
   * balanceDue on the supplier.
   */
  async receive(businessId: string, userId: string, id: string, meta: RequestMeta) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: { items: true },
    });
    if (!purchase) throw new NotFoundException('Purchase not found.');
    if (purchase.status !== 'DRAFT') {
      throw new BadRequestException('Only draft purchases can be received.');
    }

    const allowNeg = await this.inventory.negativeStockAllowed(businessId);
    const reference = await this.nextReceiptReference(businessId);

    const received = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.create({
        data: {
          businessId,
          purchaseId: purchase.id,
          reference,
          receivedById: userId,
        },
      });

      for (const item of purchase.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, isService: true, trackInventory: true, costPrice: true, stockQuantity: true },
        });
        if (!product || product.isService || !product.trackInventory) continue;

        // Stock in via the shared ledger.
        await this.inventory.applyInTx(
          tx,
          {
            businessId,
            productId: item.productId,
            type: 'PURCHASE',
            signedQty: dec(item.quantity),
            unitCost: dec(item.unitCost),
            reason: `Purchase ${purchase.reference}`,
            sourceType: 'Purchase',
            sourceId: purchase.id,
            userId,
          },
          true,
        );

        // Weighted-average cost blend. Only blend for inventory-tracked products so COGS stays correct.
        const newCost = weightedAverageCost(
          product.costPrice,
          product.stockQuantity,
          item.unitCost,
          item.quantity,
        );
        await tx.product.update({
          where: { id: item.productId },
          data: { costPrice: newCost },
        });
      }

      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'RECEIVED', receivedAt: new Date(), receivedById: userId },
      });

      return receipt;
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'purchase.receive',
      entityType: 'Purchase',
      entityId: purchase.id,
      after: { reference: purchase.reference, grn: reference },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    this.events.emit(DomainEvents.PurchaseReceived, {
      businessId,
      actorUserId: userId,
      at: new Date(),
      purchaseId: purchase.id,
    });

    return this.findOne(businessId, purchase.id);
  }

  // ─────────────────────────── Cancel ───────────────────────────

  async cancel(businessId: string, userId: string, id: string, meta: RequestMeta) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!purchase) throw new NotFoundException('Purchase not found.');
    if (purchase.status !== 'DRAFT') {
      throw new BadRequestException('Only draft purchases can be cancelled.');
    }

    const updated = await this.prisma.purchase.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: purchaseDetail,
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'purchase.cancel',
      entityType: 'Purchase',
      entityId: purchase.id,
      before: { status: purchase.status },
      after: { status: updated.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ─────────────────────────── Reads ───────────────────────────

  async list(businessId: string, q: ListPurchasesQuery) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);

    const where: Prisma.PurchaseWhereInput = {
      businessId,
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.status ? { status: q.status as Prisma.PurchaseWhereInput['status'] } : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.findMany({
        where,
        orderBy: { orderDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          supplier: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async findOne(businessId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: purchaseDetail,
    });
    if (!purchase) throw new NotFoundException('Purchase not found.');
    return purchase;
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private async nextPurchaseReference(businessId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.purchase.count({
      where: { businessId, reference: { startsWith: `PUR-${today}` } },
    });
    return `PUR-${today}-${String(count + 1).padStart(4, '0')}`;
  }

  private async nextReceiptReference(businessId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.purchaseReceipt.count({
      where: { businessId, reference: { startsWith: `GRN-${today}` } },
    });
    return `GRN-${today}-${String(count + 1).padStart(4, '0')}`;
  }
}
