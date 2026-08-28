import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Expense, type PaymentMethod } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { RequestMeta } from '../auth/auth.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DomainEvents } from '../../common/events/domain-events.js';
import { CreateExpenseDto, ListExpensesQuery } from './dto.js';

const dec = (v: number | string): Prisma.Decimal => new Prisma.Decimal(String(v));

/**
 * Expenses: money paid out of the business, outside the inventory/POS flow. Each expense is
 * written atomically with a CASH_MOVEMENT (type EXPENSE) so the cash ledger always reconciles;
 * if there is an open till session it is linked to that session.
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async create(businessId: string, userId: string, dto: CreateExpenseDto, meta: RequestMeta) {
    const reference = await this.nextExpenseReference(businessId);
    const amount = dec(dto.amount);
    const method = (dto.method ?? 'CASH') as PaymentMethod;

    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          businessId,
          reference,
          category: dto.category,
          amount,
          method,
          payee: dto.payee?.trim() || null,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          note: dto.note?.trim() || null,
          userId,
        },
      });

      // Link the outgoing movement to the open till, if any, else record it standalone.
      const openSession = await tx.cashSession.findFirst({
        where: { businessId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
        select: { id: true },
      });

      await tx.cashMovement.create({
        data: {
          businessId,
          sessionId: openSession?.id ?? null,
          type: 'EXPENSE',
          amount: amount.negated(),
          reference,
          sourceType: 'Expense',
          sourceId: created.id,
          note: dto.note?.trim() || null,
          userId,
        },
      });

      return created;
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'expense.create',
      entityType: 'Expense',
      entityId: expense.id,
      after: { reference, category: expense.category, amount: amount.toString() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    this.events.emit(DomainEvents.ExpenseRecorded, {
      businessId,
      actorUserId: userId,
      at: new Date(),
      expenseId: expense.id,
      amount: amount.toString(),
      category: expense.category,
    });

    return this.findOne(businessId, expense.id);
  }

  async list(businessId: string, q: ListExpensesQuery) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);

    const where: Prisma.ExpenseWhereInput = {
      businessId,
      voidedAt: null,
      ...(q.category ? { category: q.category as Prisma.ExpenseWhereInput['category'] } : {}),
      paidAt: {
        gte: q.from ? new Date(q.from) : undefined,
        lte: q.to ? new Date(q.to) : undefined,
      },
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async findOne(businessId: string, id: string): Promise<Expense> {
    const expense = await this.prisma.expense.findFirst({ where: { id, businessId } });
    if (!expense) throw new NotFoundException('Expense not found.');
    return expense;
  }

  private async nextExpenseReference(businessId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.expense.count({
      where: { businessId, reference: { startsWith: `EXP-${today}` } },
    });
    return `EXP-${today}-${String(count + 1).padStart(4, '0')}`;
  }
}
