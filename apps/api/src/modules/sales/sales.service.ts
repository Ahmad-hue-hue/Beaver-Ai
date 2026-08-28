import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PERMISSIONS } from '@beaver/shared';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DomainEvents } from '../../common/events/domain-events.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { saleTotals } from './totals.js';
import { ReturnValidationError, planReturns, refundTotal as refundTotalOf } from './refund.js';
import type { PlannedReturn as ReturnPlanned } from './refund.js';
import type { CreateReturnDto, CreateSaleDto, ListSalesQuery } from './dto.js';

const dec = (v: number | string | Prisma.Decimal): Prisma.Decimal => new Prisma.Decimal(String(v));
const ZERO = new Prisma.Decimal(0);
const money = (v: Prisma.Decimal): Prisma.Decimal => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

const saleDetail = {
  items: true,
  payments: true,
  customer: { select: { id: true, name: true, phone: true } },
  cashier: { select: { id: true, name: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ─────────────────────────── Create ───────────────────────────

  async create(businessId: string, actor: AuthenticatedUser, dto: CreateSaleDto, meta: RequestMeta) {
    // Idempotency: a repeated key returns the already-created sale instead of double-selling.
    if (dto.idempotencyKey) {
      const existing = await this.prisma.sale.findFirst({
        where: { businessId, idempotencyKey: dto.idempotencyKey },
        include: saleDetail,
      });
      if (existing) return existing;
    }

    if (!dto.items.length) throw new BadRequestException('A sale needs at least one item.');

    // Load + snapshot products (scoped to this business).
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, businessId, deletedAt: null, isArchived: false },
      select: {
        id: true, name: true, sellingPrice: true, minPrice: true, taxRate: true,
        costPrice: true, isService: true, trackInventory: true,
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) throw new BadRequestException(`Unknown or unavailable product(s): ${missing.join(', ')}`);

    const lines = dto.items.map((input) => {
      const product = byId.get(input.productId)!;
      const unitPrice = input.unitPrice !== undefined ? dec(input.unitPrice) : product.sellingPrice;
      if (product.minPrice && unitPrice.lessThan(product.minPrice)) {
        throw new BadRequestException(`Price for "${product.name}" is below its minimum of ${product.minPrice.toString()}.`);
      }
      return { product, input, unitPrice };
    });

    const totals = saleTotals(
      lines.map((l) => ({
        unitPrice: l.unitPrice,
        quantity: l.input.quantity,
        discount: l.input.discount ?? 0,
        taxRate: l.product.taxRate,
      })),
      dto.discount ?? 0,
    );

    // Discounting is a privileged action.
    if (totals.discountTotal.greaterThan(0) && !actor.permissions.includes(PERMISSIONS.SALES_DISCOUNT)) {
      throw new ForbiddenException('You are not allowed to apply discounts.');
    }

    // Real tenders only (CREDIT is not money received).
    const tenders = (dto.payments ?? []).filter((p) => p.method !== 'CREDIT');
    const tenderTotal = money(tenders.reduce((s, t) => s.plus(dec(t.amount)), ZERO));

    const paidTotal = tenderTotal;
    let changeGiven = ZERO;
    let balanceDue = ZERO;
    if (tenderTotal.greaterThanOrEqualTo(totals.total)) {
      changeGiven = money(tenderTotal.minus(totals.total));
    } else {
      // Short payment → the remainder is credit, which requires a customer.
      if (!dto.customerId) {
        throw new BadRequestException('Payment is less than the total. Add a payment or select a customer for credit.');
      }
      balanceDue = money(totals.total.minus(tenderTotal));
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, businessId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) throw new BadRequestException('Selected customer does not exist.');
    }

    const allowNeg = await this.inventory.negativeStockAllowed(businessId);
    const reference = await this.nextSaleReference(businessId);

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          businessId,
          reference,
          cashierId: actor.userId,
          customerId: dto.customerId ?? null,
          status: 'COMPLETED',
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          paidTotal,
          changeGiven,
          balanceDue,
          note: dto.note?.trim() || null,
          idempotencyKey: dto.idempotencyKey ?? null,
          items: {
            create: lines.map((l, idx) => ({
              businessId,
              productId: l.product.id,
              nameSnapshot: l.product.name,
              unitPrice: l.unitPrice,
              quantity: dec(l.input.quantity),
              discount: totals.lines[idx]!.discount,
              taxRate: l.product.taxRate,
              costSnapshot: l.product.costPrice,
              lineTotal: totals.lines[idx]!.lineTotal,
            })),
          },
          payments: {
            create: tenders.map((t) => ({
              businessId,
              method: t.method,
              amount: dec(t.amount),
              reference: t.reference?.trim() || null,
            })),
          },
        },
        include: saleDetail,
      });

      // Decrement stock for each inventory-tracked line, appending to the shared ledger.
      for (const l of lines) {
        if (l.product.isService || !l.product.trackInventory) continue;
        await this.inventory.applyInTx(
          tx,
          {
            businessId,
            productId: l.product.id,
            type: 'SALE',
            signedQty: dec(l.input.quantity).negated(),
            unitCost: l.product.costPrice,
            reason: `Sale ${reference}`,
            sourceType: 'Sale',
            sourceId: created.id,
            userId: actor.userId,
          },
          allowNeg,
        );
      }

      if (balanceDue.greaterThan(0) && dto.customerId) {
        const updated = await tx.customer.update({
          where: { id: dto.customerId },
          data: { balance: { increment: balanceDue } },
          select: { balance: true },
        });
        await tx.customerDebtTransaction.create({
          data: {
            businessId,
            customerId: dto.customerId,
            type: 'SALE_CREDIT',
            amount: balanceDue,
            balanceAfter: updated.balance,
            sourceType: 'Sale',
            sourceId: created.id,
            note: `Credit sale ${reference}`,
          },
        });
      }

      return created;
    });

    await this.audit.record({
      businessId,
      userId: actor.userId,
      action: 'sale.create',
      entityType: 'Sale',
      entityId: sale.id,
      after: { reference, total: totals.total.toString(), balanceDue: balanceDue.toString() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    this.events.emit(DomainEvents.SaleCompleted, {
      businessId,
      actorUserId: actor.userId,
      at: new Date(),
      saleId: sale.id,
      total: totals.total.toString(),
      hasCredit: balanceDue.greaterThan(0),
    });
    if (balanceDue.greaterThan(0) && dto.customerId) {
      this.events.emit(DomainEvents.DebtChanged, {
        businessId,
        actorUserId: actor.userId,
        at: new Date(),
        customerId: dto.customerId,
        balance: balanceDue.toString(),
      });
    }

    return sale;
  }

  // ─────────────────────────── Reads ───────────────────────────

  async list(businessId: string, q: ListSalesQuery) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);

    const where: Prisma.SaleWhereInput = {
      businessId,
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.cashierId ? { cashierId: q.cashierId } : {}),
    };
    const range = q.period ? this.rangeFor(q.period) : this.explicitRange(q.from, q.to);
    if (range) where.soldAt = range;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        orderBy: { soldAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { id: true, name: true } },
          cashier: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async findOne(businessId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: { ...saleDetail, returns: { include: { items: true } } },
    });
    if (!sale) throw new NotFoundException('Sale not found.');
    return sale;
  }

  /** Lightweight KPI feed for the dashboard (full analytics land in M5). */
  async summary(businessId: string, period = 'today') {
    const range = this.rangeFor(period) ?? this.rangeFor('today')!;
    const where: Prisma.SaleWhereInput = { businessId, status: 'COMPLETED', soldAt: range };

    const [agg, itemsAgg] = await this.prisma.$transaction([
      this.prisma.sale.aggregate({ where, _sum: { total: true }, _count: true }),
      this.prisma.saleItem.aggregate({
        where: { businessId, sale: { status: 'COMPLETED', soldAt: range } },
        _sum: { quantity: true },
      }),
    ]);

    return {
      period,
      count: agg._count,
      revenue: (agg._sum.total ?? ZERO).toString(),
      itemsSold: (itemsAgg._sum.quantity ?? ZERO).toString(),
    };
  }

  // ─────────────────────────── Void ───────────────────────────

  async void(businessId: string, actor: AuthenticatedUser, id: string, meta: RequestMeta) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Sale not found.');
    if (sale.status === 'VOIDED') throw new BadRequestException('This sale is already voided.');

    await this.prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { isService: true, trackInventory: true },
        });
        if (!product || product.isService || !product.trackInventory) continue;
        await this.inventory.applyInTx(
          tx,
          {
            businessId,
            productId: item.productId,
            type: 'RETURN',
            signedQty: item.quantity, // put the sold quantity back
            reason: `Void ${sale.reference}`,
            sourceType: 'SaleVoid',
            sourceId: sale.id,
            userId: actor.userId,
          },
          true,
        );
      }

      if (sale.balanceDue.greaterThan(0) && sale.customerId) {
        const updated = await tx.customer.update({
          where: { id: sale.customerId },
          data: { balance: { decrement: sale.balanceDue } },
          select: { balance: true },
        });
        await tx.customerDebtTransaction.create({
          data: {
            businessId,
            customerId: sale.customerId,
            type: 'ADJUSTMENT',
            amount: sale.balanceDue.negated(), // reverse the credit
            balanceAfter: updated.balance,
            sourceType: 'SaleVoid',
            sourceId: sale.id,
            note: `Void ${sale.reference} reverses credit`,
          },
        });
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'VOIDED', voidedAt: new Date() },
      });
    });

    await this.audit.record({
      businessId,
      userId: actor.userId,
      action: 'sale.void',
      entityType: 'Sale',
      entityId: sale.id,
      after: { reference: sale.reference },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    this.events.emit(DomainEvents.SaleVoided, {
      businessId,
      actorUserId: actor.userId,
      at: new Date(),
      saleId: sale.id,
    });

    return this.findOne(businessId, sale.id);
  }

  // ─────────────────────────── Returns ───────────────────────────

  async createReturn(businessId: string, actor: AuthenticatedUser, saleId: string, dto: CreateReturnDto, meta: RequestMeta) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: { items: true, returns: { include: { items: true } } },
    });
    if (!sale) throw new NotFoundException('Sale not found.');
    if (sale.status === 'VOIDED') throw new BadRequestException('Cannot return a voided sale.');

    const itemById = new Map(sale.items.map((i) => [i.id, i]));
    // How much of each sale line has already been returned.
    const returnedByItem = new Map<string, Prisma.Decimal>();
    for (const r of sale.returns) {
      for (const ri of r.items) {
        returnedByItem.set(ri.saleItemId, (returnedByItem.get(ri.saleItemId) ?? ZERO).plus(ri.quantity));
      }
    }

    // Validate that every requested line belongs to this sale.
    for (const input of dto.items) {
      if (!itemById.has(input.saleItemId)) {
        throw new BadRequestException(`Sale item ${input.saleItemId} is not part of this sale.`);
      }
    }

    let planned: ReturnPlanned[];
    try {
      planned = planReturns(
        dto.items.map((input) => {
          const saleItem = itemById.get(input.saleItemId)!;
          return {
            saleItemId: saleItem.id,
            name: saleItem.nameSnapshot,
            lineTotal: saleItem.lineTotal,
            quantity: saleItem.quantity,
            alreadyReturned: returnedByItem.get(saleItem.id) ?? ZERO,
            returnQty: dec(input.quantity),
          };
        }),
      );
    } catch (e) {
      if (e instanceof ReturnValidationError) throw new BadRequestException(e.message);
      throw e;
    }
    // Attach the sale item back for the transactional write below.
    const plannedWithItems = planned.map((p) => ({ ...p, saleItem: itemById.get(p.saleItemId)! }));
    const refundTotal = refundTotalOf(planned);
    const reference = await this.nextReturnReference(businessId);

    const ret = await this.prisma.$transaction(async (tx) => {
      const created = await tx.return.create({
        data: {
          businessId,
          reference,
          saleId: sale.id,
          cashierId: actor.userId,
          reason: dto.reason?.trim() || null,
          refundTotal,
          items: {
            create: plannedWithItems.map((p) => ({
              businessId,
              saleItemId: p.saleItem.id,
              productId: p.saleItem.productId,
              quantity: p.quantity,
              refundAmount: p.refundAmount,
            })),
          },
        },
        include: { items: true },
      });

      // Restock returned inventory-tracked items.
      for (const p of plannedWithItems) {
        const product = await tx.product.findUnique({
          where: { id: p.saleItem.productId },
          select: { isService: true, trackInventory: true },
        });
        if (!product || product.isService || !product.trackInventory) continue;
        await this.inventory.applyInTx(
          tx,
          {
            businessId,
            productId: p.saleItem.productId,
            type: 'RETURN',
            signedQty: p.quantity,
            reason: `Return ${reference}`,
            sourceType: 'Return',
            sourceId: created.id,
            userId: actor.userId,
          },
          true,
        );
      }

      // Record the money going back out as a negative payment against the sale.
      await tx.salePayment.create({
        data: { businessId, saleId: sale.id, method: 'CASH', amount: refundTotal.negated() },
      });

      return created;
    });

    await this.audit.record({
      businessId,
      userId: actor.userId,
      action: 'sale.return',
      entityType: 'Return',
      entityId: ret.id,
      after: { reference, saleReference: sale.reference, refundTotal: refundTotal.toString() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    this.events.emit(DomainEvents.SaleReturned, {
      businessId,
      actorUserId: actor.userId,
      at: new Date(),
      saleId: sale.id,
      returnId: ret.id,
      refundTotal: refundTotal.toString(),
    });

    return ret;
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private explicitRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  /** Named period → [start, end) in server time. */
  private rangeFor(period: string): Prisma.DateTimeFilter | undefined {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'today') {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { gte: start, lt: end };
    }
    if (period === 'week') {
      const s = new Date(start);
      s.setDate(s.getDate() - 6);
      return { gte: s };
    }
    if (period === 'month') {
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
    return undefined;
  }

  private async nextSaleReference(businessId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.sale.count({
      where: { businessId, reference: { startsWith: `SALE-${today}` } },
    });
    return `SALE-${today}-${String(count + 1).padStart(4, '0')}`;
  }

  private async nextReturnReference(businessId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.return.count({
      where: { businessId, reference: { startsWith: `RET-${today}` } },
    });
    return `RET-${today}-${String(count + 1).padStart(3, '0')}`;
  }
}
