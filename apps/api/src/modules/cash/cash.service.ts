import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { RequestMeta } from '../auth/auth.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DomainEvents } from '../../common/events/domain-events.js';
import {
  CloseCashSessionDto,
  ListCashMovementsQuery,
  OpenCashSessionDto,
} from './dto.js';
import { reconcile } from './reconcile.js';

const dec = (v: number | string | Prisma.Decimal): Prisma.Decimal => new Prisma.Decimal(String(v));

@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ─────────────────────────── Open ───────────────────────────

  async open(businessId: string, userId: string, dto: OpenCashSessionDto, meta: RequestMeta) {
    const openSession = await this.prisma.cashSession.findFirst({
      where: { businessId, status: 'OPEN' },
    });
    if (openSession) throw new BadRequestException('A till session is already open for this business.');

    const openingBalance = dec(dto.openingBalance);
    const reference = await this.nextSessionReference(businessId);

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashSession.create({
        data: {
          businessId,
          reference,
          status: 'OPEN',
          openedBy: userId,
          openingBalance,
          closingNotes: dto.openingNotes?.trim() || null,
        },
      });

      await tx.cashMovement.create({
        data: {
          businessId,
          sessionId: created.id,
          type: 'OPENING_BALANCE',
          amount: openingBalance,
          reference,
          sourceType: 'CashSession',
          sourceId: created.id,
          note: 'Till opening balance',
          userId,
        },
      });

      return created;
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'cash.open',
      entityType: 'CashSession',
      entityId: session.id,
      after: { reference, openingBalance: openingBalance.toString() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.findOne(businessId, session.id);
  }

  // ─────────────────────────── Close ───────────────────────────

  async close(businessId: string, userId: string, id: string, dto: CloseCashSessionDto, meta: RequestMeta) {
    const session = await this.prisma.cashSession.findFirst({ where: { id, businessId } });
    if (!session) throw new NotFoundException('Cash session not found.');
    if (session.status !== 'OPEN') throw new BadRequestException('This cash session is already closed.');

    const countedCash = dec(dto.countedCash);
    const closingAt = new Date();

    const closed = await this.prisma.$transaction(async (tx) => {
      const movements = await tx.cashMovement.findMany({ where: { sessionId: session.id } });
      const { expectedCash, variance } = reconcile(
        session.openingBalance,
        movements.map((m) => m.amount),
        countedCash,
      );

      // Reconcile the ledger to the physical count.
      if (!variance.isZero()) {
        await tx.cashMovement.create({
          data: {
            businessId,
            sessionId: session.id,
            type: 'CLOSING_ADJUSTMENT',
            amount: variance,
            sourceType: 'CashSession',
            sourceId: session.id,
            note: 'Reconciliation adjustment on close',
            userId,
          },
        });
      }

      const clos = await tx.cashSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          closingById: userId,
          closingAt,
          expectedCash,
          countedCash,
          variance,
          closingNotes: dto.notes?.trim() || null,
        },
      });
      return { ...clos, adjustmentAmount: variance };
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'cash.close',
      entityType: 'CashSession',
      entityId: session.id,
      before: { status: session.status },
      after: {
        reference: session.reference,
        expectedCash: closed.expectedCash?.toString(),
        countedCash: closed.countedCash?.toString(),
        variance: closed.variance?.toString(),
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    this.events.emit(DomainEvents.CashSessionClosed, {
      businessId,
      actorUserId: userId,
      at: closingAt,
      sessionId: session.id,
      expectedCash: closed.expectedCash?.toString(),
      countedCash: closed.countedCash?.toString(),
      variance: closed.variance?.toString(),
    });

    return this.findOne(businessId, session.id);
  }

  // ─────────────────────────── Reads ───────────────────────────

  async listSessions(businessId: string) {
    return this.prisma.cashSession.findMany({
      where: { businessId },
      orderBy: { openedAt: 'desc' },
      include: {
        _count: { select: { movements: true } },
      },
    });
  }

  async findOne(businessId: string, id: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id, businessId },
      include: {
        movements: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) throw new NotFoundException('Cash session not found.');
    return session;
  }

  async current(businessId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { businessId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });
    return session ?? null;
  }

  async listMovements(businessId: string, q: ListCashMovementsQuery) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 50, 200);

    const where: Prisma.CashMovementWhereInput = {
      businessId,
      ...(q.sessionId ? { sessionId: q.sessionId } : {}),
      ...(q.type ? { type: q.type as Prisma.CashMovementWhereInput['type'] } : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.cashMovement.count({ where }),
      this.prisma.cashMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private async nextSessionReference(businessId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.cashSession.count({
      where: { businessId, reference: { startsWith: `TILL-${today}` } },
    });
    return `TILL-${today}-${String(count + 1).padStart(4, '0')}`;
  }
}
