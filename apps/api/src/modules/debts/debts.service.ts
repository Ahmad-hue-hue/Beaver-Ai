import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { RequestMeta } from '../auth/auth.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DomainEvents } from '../../common/events/domain-events.js';
import { CreateCustomerPaymentDto, ListDebtorsQuery } from './dto.js';
import { ageLedger, totalOutstanding, EMPTY_BUCKETS } from './aging.js';

const dec = (v: number | string | Prisma.Decimal): Prisma.Decimal => new Prisma.Decimal(String(v));

/**
 * Full customer debt (M4): collect payments against the running balance, expose an immutable
 * per-customer ledger, and age outstanding credit (FIFO, by sale date). All writes are atomic.
 */
@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ─────────────────────────── Payments ───────────────────────────

  async recordPayment(
    businessId: string,
    userId: string,
    customerId: string,
    dto: CreateCustomerPaymentDto,
    meta: RequestMeta,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found.');

    const amount = dec(dto.amount);
    const reference = await this.nextPaymentReference(businessId);

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: { balance: { decrement: amount } },
        select: { balance: true },
      });

      if (updated.balance.lessThan(0)) {
        throw new BadRequestException('Payment exceeds the customer balance.');
      }

      const payment = await tx.customerPayment.create({
        data: {
          businessId,
          reference,
          customerId: customer.id,
          amount,
          method: (dto.method ?? 'CASH') as 'CASH' | 'MOBILE_MONEY' | 'BANK' | 'CARD',
          referenceNo: dto.referenceNo?.trim() || null,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          note: dto.note?.trim() || null,
          userId,
        },
      });

      await tx.customerDebtTransaction.create({
        data: {
          businessId,
          customerId: customer.id,
          type: 'PAYMENT',
          amount: amount.negated(), // reduces debt
          balanceAfter: updated.balance,
          sourceType: 'CustomerPayment',
          sourceId: payment.id,
          note: dto.note?.trim() || null,
        },
      });

      // Money received — link to the open till if one exists.
      const openSession = await tx.cashSession.findFirst({
        where: { businessId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
        select: { id: true },
      });
      await tx.cashMovement.create({
        data: {
          businessId,
          sessionId: openSession?.id ?? null,
          type: 'CUSTOMER_PAYMENT',
          amount,
          reference,
          sourceType: 'CustomerPayment',
          sourceId: payment.id,
          note: `Payment from ${customer.name}`,
          userId,
        },
      });

      return { payment, balance: updated.balance };
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'customer.payment',
      entityType: 'CustomerPayment',
      entityId: result.payment.id,
      after: { reference, customerId: customer.id, amount: amount.toString(), balance: result.balance.toString() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    this.events.emit(DomainEvents.DebtChanged, {
      businessId,
      actorUserId: userId,
      at: new Date(),
      customerId: customer.id,
      balance: result.balance.toString(),
    });

    return result.payment;
  }

  // ─────────────────────────── Statement / reads ───────────────────────────

  async statement(businessId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found.');

    const entries = await this.prisma.customerDebtTransaction.findMany({
      where: { businessId, customerId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      customer: { id: customer.id, name: customer.name },
      balance: customer.balance,
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount,
        balanceAfter: e.balanceAfter,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        note: e.note,
        createdAt: e.createdAt,
      })),
    };
  }

  async overview(businessId: string, q: ListDebtorsQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const where: Prisma.CustomerWhereInput = {
      businessId,
      deletedAt: null,
      balance: { gt: 0 },
      ...(q.search?.trim()
        ? {
            OR: [
              { name: { contains: q.search.trim(), mode: 'insensitive' } },
              { phone: { contains: q.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { balance: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, name: true, phone: true, balance: true, creditLimit: true },
      }),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  /** Aggregate outstanding by age buckets across all active debtors (sale-credit dated). */
  async aging(businessId: string) {
    const debtors = await this.prisma.customer.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true, name: true, balance: true },
    });

    const byCustomer: Record<string, { name: string; balance: Prisma.Decimal; buckets: typeof EMPTY_BUCKETS }> = {};
    for (const d of debtors) {
      const ledger = await this.prisma.customerDebtTransaction.findMany({
        where: { businessId, customerId: d.id },
        orderBy: { createdAt: 'asc' },
        select: { type: true, amount: true, createdAt: true },
      });
      const buckets = ageLedger(
        ledger.map((l) => ({ type: l.type, amount: l.amount, createdAt: l.createdAt })),
        new Date(),
      );
      byCustomer[d.id] = { name: d.name, balance: d.balance, buckets };
    }

    const totals = { ...EMPTY_BUCKETS };
    const rows = Object.entries(byCustomer).map(([id, c]) => {
      totals.current = totals.current.plus(c.buckets.current);
      totals.days1to30 = totals.days1to30.plus(c.buckets.days1to30);
      totals.days31to60 = totals.days31to60.plus(c.buckets.days31to60);
      totals.days60plus = totals.days60plus.plus(c.buckets.days60plus);
      return { customerId: id, name: c.name, balance: c.balance, ...c.buckets };
    });

    return {
      totals: { ...totals, total: totalOutstanding(totals) },
      debtors: rows,
    };
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private async nextPaymentReference(businessId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.customerPayment.count({
      where: { businessId, reference: { startsWith: `PAY-${today}` } },
    });
    return `PAY-${today}-${String(count + 1).padStart(4, '0')}`;
  }
}
