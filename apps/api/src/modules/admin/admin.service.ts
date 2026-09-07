import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { normalizePhone } from '../../common/phone.js';
import { tempPassword } from '../members/members.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { DomainEvents } from '../../common/events/domain-events.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { ListPaymentsQuery, RecordPaymentDto, UpdateBusinessDto, UpdatePaymentDto, UpdateUserDto } from './dto.js';
import { reverseSubscriptionExtension, subscriptionPeriodFor } from './subscription-period.js';

export interface AdminListParams {
  search?: string;
  limit?: string;
  cursor?: string;
}

export interface AdminActivityParams extends AdminListParams {
  businessId?: string;
  action?: string;
  entityType?: string;
}

const searchField = (v: string | undefined) => (v === undefined ? undefined : v.trim());

const dec = (v: number | string | Prisma.Decimal): Prisma.Decimal => new Prisma.Decimal(String(v));

/** Subscription payments are real money in — credit is never a valid method. */
const REAL_MONEY_METHODS = ['CASH', 'MOBILE_MONEY', 'BANK', 'CARD'] as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /** Platform-wide headline numbers for the admin dashboard. */
  async overview() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalBusinesses, totalUsers, platformAdmins, pendingUsers, expiredUsers, salesToday, revenueToday, signupsToday, recentSignups] =
      await Promise.all([
        this.prisma.business.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { isPlatformAdmin: true, deletedAt: null } }),
        this.prisma.user.count({ where: { deletedAt: null, approvedAt: null } }),
        this.prisma.user.count({
          where: {
            deletedAt: null,
            approvedAt: { not: null },
            serviceExpiresAt: { not: null, lte: new Date() },
          },
        }),
        this.prisma.sale.count({
          where: { soldAt: { gte: startOfToday }, status: 'COMPLETED', voidedAt: null },
        }),
        this.prisma.sale.aggregate({
          where: { soldAt: { gte: startOfToday }, status: 'COMPLETED', voidedAt: null },
          _sum: { total: true },
        }),
        this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: startOfToday } } }),
        this.prisma.user.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 6,
          select: { id: true, name: true, phone: true, isPlatformAdmin: true, approvedAt: true, createdAt: true },
        }),
      ]);

    return {
      totalBusinesses,
      totalUsers,
      platformAdmins,
      pendingUsers,
      expiredUsers,
      activeUsers: totalUsers - pendingUsers - expiredUsers,
      salesToday,
      revenueToday: (revenueToday._sum.total as unknown as number) ?? 0,
      signupsToday,
      recentSignups,
    };
  }

  /** All businesses with owner + subscription state + high-level stats. */
  async listBusinesses(params: AdminListParams) {
    const search = searchField(params.search);
    const take = Math.min(Math.max(Number(params.limit) || 50, 1), 100);

    const where: Prisma.BusinessWhereInput = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
        { memberships: { some: { user: { OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ] } } } },
      ];
    }

    const [rows, revenue] = await Promise.all([
      this.prisma.business.findMany({
        where,
        orderBy: { createdAt: 'desc' as const },
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          name: true,
          type: true,
          country: true,
          currency: true,
          phone: true,
          address: true,
          createdAt: true,
          memberships: {
            where: { status: 'ACTIVE' },
            select: {
              role: true,
              user: { select: { id: true, name: true, phone: true, approvedAt: true, serviceExpiresAt: true } },
            },
            orderBy: { createdAt: 'asc' as const },
          },
          _count: {
            select: {
              products: { where: { deletedAt: null } },
              sales: { where: { voidedAt: null } },
            },
          },
        },
      }),
      this.prisma.sale.groupBy({
        by: ['businessId'],
        where: { status: 'COMPLETED', voidedAt: null },
        _sum: { total: true },
      }),
    ]);

    const revenueByBusiness = new Map(revenue.map((r) => [r.businessId, r._sum.total]));
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    return {
      items: page.map((b) => {
        const owner = b.memberships[0]?.user ?? null;
        return {
          id: b.id,
          name: b.name,
          type: b.type,
          country: b.country,
          currency: b.currency,
          phone: b.phone,
          createdAt: b.createdAt,
          owner,
          ownerSubscription: owner
            ? { status: AdminService.subscriptionStatus(owner), serviceExpiresAt: owner.serviceExpiresAt }
            : null,
          memberCount: b.memberships.length,
          productCount: b._count.products,
          salesCount: b._count.sales,
          revenue: (revenueByBusiness.get(b.id) as unknown as number) ?? 0,
        };
      }),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      hasMore,
    };
  }

  /** All platform users with their subscription state. */
  async listUsers(params: AdminListParams) {
    const search = searchField(params.search);
    const take = Math.min(Math.max(Number(params.limit) || 50, 1), 100);

    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ];
    }

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' as const },
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        phone: true,
        isPlatformAdmin: true,
        approvedAt: true,
        serviceExpiresAt: true,
        createdAt: true,
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      items: page.map((u) => ({
        ...u,
        serviceStatus: AdminService.subscriptionStatus(u),
        memberCount: u._count.memberships,
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      hasMore,
    };
  }

  /**
   * Accounts awaiting (or needing) admin action: never approved, or their paid month has
   * lapsed. Sorting: pending first, then most recently expired.
   */
  async listReviews(params: AdminListParams) {
    const search = searchField(params.search);
    const take = Math.min(Math.max(Number(params.limit) || 50, 1), 100);

    const needsAttention: Prisma.UserWhereInput[] = [
      { approvedAt: null },
      { approvedAt: { not: null }, serviceExpiresAt: { not: null, lte: new Date() } },
    ];

    const where: Prisma.UserWhereInput = { deletedAt: null, OR: needsAttention };
    if (search) {
      where.AND = [
        { OR: needsAttention },
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        },
      ];
    }

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ approvedAt: 'asc' as const }, { serviceExpiresAt: 'asc' as const }],
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        phone: true,
        isPlatformAdmin: true,
        approvedAt: true,
        serviceExpiresAt: true,
        createdAt: true,
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      items: page.map((u) => ({
        ...u,
        serviceStatus: AdminService.subscriptionStatus(u),
        memberCount: u._count.memberships,
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      hasMore,
    };
  }

  /** Approve a pending account: marks approval + grants the first paid month (30 days). */
  async activateUser(adminId: string, userId: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found.');

    const now = new Date();
    const { periodEnd: serviceExpiresAt } = subscriptionPeriodFor(user.serviceExpiresAt, now, 1);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        approvedAt: user.approvedAt ?? now,
        serviceExpiresAt,
      },
    });

    await this.audit.record({
      userId: adminId,
      action: 'admin.user_activate',
      entityType: 'User',
      entityId: userId,
      before: { approvedAt: user.approvedAt, serviceExpiresAt: user.serviceExpiresAt },
      after: { approvedAt: updated.approvedAt, serviceExpiresAt: updated.serviceExpiresAt },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: userId, approvedAt: updated.approvedAt, serviceExpiresAt };
  }

  /** Renew an active-or-expired account for another 30 days (never shortens an active month). */
  async renewUser(adminId: string, userId: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found.');
    if (!user.approvedAt) return this.activateUser(adminId, userId, meta);

    const now = new Date();
    const { periodEnd: serviceExpiresAt } = subscriptionPeriodFor(user.serviceExpiresAt, now, 1);

    await this.prisma.user.update({
      where: { id: userId },
      data: { serviceExpiresAt },
    });

    await this.audit.record({
      userId: adminId,
      action: 'admin.user_renew',
      entityType: 'User',
      entityId: userId,
      before: { serviceExpiresAt: user.serviceExpiresAt },
      after: { serviceExpiresAt },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: userId, serviceExpiresAt };
  }

  static subscriptionStatus(user: {
    approvedAt: Date | null;
    serviceExpiresAt: Date | null;
  }): 'PENDING' | 'ACTIVE' | 'EXPIRED' {
    if (!user.approvedAt) return 'PENDING';
    if (!user.serviceExpiresAt || user.serviceExpiresAt.getTime() > Date.now()) return 'ACTIVE';
    return 'EXPIRED';
  }

  /** System-wide audit feed across every business (the "see all activities" view). */
  async listActivities(params: AdminActivityParams) {
    const search = searchField(params.action);
    const take = Math.min(Math.max(Number(params.limit) || 50, 1), 200);

    const where: Prisma.AuditLogWhereInput = {};
    if (params.businessId) where.businessId = params.businessId;
    if (search) where.action = { contains: search };
    if (params.entityType) where.entityType = params.entityType;

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, name: true, phone: true } },
        business: { select: { id: true, name: true } },
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      hasMore,
    };
  }

  // ─────────────────────────── User CRUD ───────────────────────────

  /**
   * Edit a platform account. Password hashes are never exposed here; role
   * changes are audited. The caller can never strip their own platform-admin
   * flag, and the last platform admin cannot be demoted.
   */
  async updateUser(adminId: string, userId: string, dto: UpdateUserDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found.');

    if (dto.isPlatformAdmin === false && userId === adminId) {
      throw new ForbiddenException('You cannot remove your own platform-admin access.');
    }
    if (dto.isPlatformAdmin === false && user.isPlatformAdmin) {
      const remaining = await this.prisma.user.count({
        where: { isPlatformAdmin: true, deletedAt: null, id: { not: userId } },
      });
      if (remaining === 0) {
        throw new ConflictException('Cannot demote the last platform admin.');
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) data.phone = normalizePhone(dto.phone);
    if (dto.isPlatformAdmin !== undefined) data.isPlatformAdmin = dto.isPlatformAdmin;
    if (dto.approvedAt !== undefined) data.approvedAt = new Date(dto.approvedAt);
    if (dto.serviceExpiresAt !== undefined) data.serviceExpiresAt = new Date(dto.serviceExpiresAt);
    if (Object.keys(data).length === 0) throw new BadRequestException('Nothing to update.');

    const updated = await this.prisma.user.update({ where: { id: userId }, data });

    await this.audit.record({
      userId: adminId,
      action: 'admin.user_update',
      entityType: 'User',
      entityId: userId,
      before: {
        name: user.name,
        phone: user.phone,
        isPlatformAdmin: user.isPlatformAdmin,
        approvedAt: user.approvedAt,
        serviceExpiresAt: user.serviceExpiresAt,
      },
      after: {
        name: updated.name,
        phone: updated.phone,
        isPlatformAdmin: updated.isPlatformAdmin,
        approvedAt: updated.approvedAt,
        serviceExpiresAt: updated.serviceExpiresAt,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  /**
   * Soft-delete a platform account. History (payments, audit) is preserved.
   * Self-delete and deleting the last platform admin are refused.
   */
  async deleteUser(adminId: string, userId: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found.');
    if (userId === adminId) throw new ForbiddenException('You cannot delete your own account.');
    if (user.isPlatformAdmin) {
      const remaining = await this.prisma.user.count({
        where: { isPlatformAdmin: true, deletedAt: null, id: { not: userId } },
      });
      if (remaining === 0) throw new ConflictException('Cannot delete the last platform admin.');
    }

    const now = new Date();
    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: now } });

    await this.audit.record({
      userId: adminId,
      action: 'admin.user_delete',
      entityType: 'User',
      entityId: userId,
      before: { phone: user.phone, name: user.name },
      after: { deletedAt: now },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: userId, deletedAt: now };
  }

  /**
   * Reject a pending signup (triage from the reviews queue). Only accounts that
   * were never approved can be rejected — approved accounts go through delete.
   */
  async rejectUser(adminId: string, userId: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found.');
    if (user.approvedAt) {
      throw new BadRequestException('Account is already approved — delete it instead of rejecting.');
    }

    const now = new Date();
    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: now } });

    await this.audit.record({
      userId: adminId,
      action: 'admin.user_reject',
      entityType: 'User',
      entityId: userId,
      before: { phone: user.phone, name: user.name },
      after: { deletedAt: now },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: userId, deletedAt: now };
  }

  /**
   * Issue a temporary password for an account (the no-email recovery flow).
   * Sets the hash, revokes every session, and returns the plaintext ONCE for
   * the admin to hand over — it is never stored or logged. The user signs in
   * with phone + temporary password, then sets their own via change-password.
   */
  async resetUserPassword(adminId: string, userId: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found.');
    if (userId === adminId) {
      throw new ForbiddenException('Use change-password for your own account.');
    }

    const temporaryPassword = tempPassword();
    const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    await this.audit.record({
      userId: adminId,
      action: 'admin.user_password_reset',
      entityType: 'User',
      entityId: userId,
      before: { phone: user.phone, name: user.name },
      after: { sessionsRevokedAt: now },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: userId, temporaryPassword };
  }

  // ─────────────────────────── Business CRUD ───────────────────────────

  /** Edit a business profile (audited). */
  async updateBusiness(adminId: string, businessId: string, dto: UpdateBusinessDto, meta: RequestMeta) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business || business.deletedAt) throw new NotFoundException('Business not found.');

    const data: Prisma.BusinessUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.type !== undefined) data.type = dto.type as Prisma.BusinessUpdateInput['type'];
    if (dto.country !== undefined) data.country = dto.country.trim().toUpperCase();
    if (dto.currency !== undefined) data.currency = dto.currency.trim().toUpperCase();
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.address !== undefined) data.address = dto.address.trim() || null;
    if (Object.keys(data).length === 0) throw new BadRequestException('Nothing to update.');

    const updated = await this.prisma.business.update({ where: { id: businessId }, data });

    await this.audit.record({
      userId: adminId,
      businessId,
      action: 'admin.business_update',
      entityType: 'Business',
      entityId: businessId,
      before: {
        name: business.name,
        type: business.type,
        country: business.country,
        currency: business.currency,
        phone: business.phone,
        address: business.address,
      },
      after: {
        name: updated.name,
        type: updated.type,
        country: updated.country,
        currency: updated.currency,
        phone: updated.phone,
        address: updated.address,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  /**
   * Delete a business. The business is soft-deleted and its whole team is
   * detached in the same atomic transaction (membership rows are dropped, user
   * accounts are kept — the same mechanism as removing a single member).
   * Shop data (products, sales, payments) is preserved under the soft-deleted
   * business for history and can be restored by clearing `deletedAt`.
   */
  async deleteBusiness(adminId: string, businessId: string, meta: RequestMeta) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business || business.deletedAt) throw new NotFoundException('Business not found.');

    const memberships = await this.prisma.membership.findMany({
      where: { businessId },
      select: { id: true, userId: true, role: true, status: true },
    });

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.deleteMany({ where: { businessId } });
      await tx.business.update({ where: { id: businessId }, data: { deletedAt: now } });
    });

    await this.audit.record({
      userId: adminId,
      businessId,
      action: 'admin.business_delete',
      entityType: 'Business',
      entityId: businessId,
      before: { name: business.name, memberships: memberships.length },
      after: { deletedAt: now, detachedMemberships: memberships.length },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: businessId, deletedAt: now, detachedMemberships: memberships.length };
  }

  // ─────────────────────────── Subscription payments ───────────────────────────

  /** Paginated payment ledger for the admin console (newest first). */
  async listPayments(params: ListPaymentsQuery) {
    const take = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const where: Prisma.SubscriptionPaymentWhereInput = {};
    if (params.userId) where.userId = params.userId;
    if (!params.includeVoided) where.voidedAt = null;

    const rows = await this.prisma.subscriptionPayment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, name: true, phone: true } },
        business: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      hasMore,
    };
  }

  /**
   * Record a subscription payment: one atomic transaction writes the payment
   * row and extends the payer's subscription (never shortens an active month).
   * Emits `subscription.paid` for future consumers (notifications/agents).
   */
  async recordPayment(adminId: string, dto: RecordPaymentDto, meta: RequestMeta) {
    const method = dto.method ?? 'CASH';
    if (!(REAL_MONEY_METHODS as readonly string[]).includes(method)) {
      throw new BadRequestException('Subscription payments must be real money (cash, mobile money, bank or card).');
    }
    const months = dto.months ?? 1;
    const amount = dec(dto.amount);

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user || user.deletedAt) throw new NotFoundException('Account not found.');

    if (dto.businessId) {
      const business = await this.prisma.business.findUnique({ where: { id: dto.businessId } });
      if (!business || business.deletedAt) throw new NotFoundException('Business not found.');
    }

    const now = new Date();
    const { periodStart, periodEnd } = subscriptionPeriodFor(user.serviceExpiresAt, now, months);

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.create({
        data: {
          userId: user.id,
          businessId: dto.businessId ?? null,
          amount,
          method: method as 'CASH' | 'MOBILE_MONEY' | 'BANK' | 'CARD',
          referenceNo: dto.referenceNo?.trim() || null,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : now,
          months,
          periodStart,
          periodEnd,
          note: dto.note?.trim() || null,
          recordedById: adminId,
        },
      });

      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          approvedAt: user.approvedAt ?? now,
          serviceExpiresAt: periodEnd,
          lastPaymentAmount: amount,
        },
      });

      return { payment, serviceExpiresAt: updated.serviceExpiresAt };
    });

    await this.audit.record({
      userId: adminId,
      businessId: dto.businessId ?? null,
      action: 'admin.payment_record',
      entityType: 'SubscriptionPayment',
      entityId: result.payment.id,
      before: { approvedAt: user.approvedAt, serviceExpiresAt: user.serviceExpiresAt },
      after: {
        amount: amount.toString(),
        method,
        months,
        periodStart,
        periodEnd,
        serviceExpiresAt: result.serviceExpiresAt,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    this.events.emit(DomainEvents.SubscriptionPaid, {
      userId: user.id,
      paymentId: result.payment.id,
      amount: amount.toString(),
      months,
      at: now,
    });

    return result.payment;
  }

  /**
   * Correct a payment's money details. The granted period (`months`,
   * `periodStart/End`) is immutable — a wrong duration is fixed by voiding and
   * re-recording so the ledger always shows what was granted and reversed.
   */
  async updatePayment(adminId: string, paymentId: string, dto: UpdatePaymentDto, meta: RequestMeta) {
    const payment = await this.prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found.');
    if (payment.voidedAt) throw new ConflictException('Voided payments are immutable.');

    const method = dto.method ?? payment.method;
    if (!(REAL_MONEY_METHODS as readonly string[]).includes(method)) {
      throw new BadRequestException('Subscription payments must be real money (cash, mobile money, bank or card).');
    }

    const data: Prisma.SubscriptionPaymentUpdateInput = {};
    if (dto.amount !== undefined) data.amount = dec(dto.amount);
    if (dto.method !== undefined) data.method = method as 'CASH' | 'MOBILE_MONEY' | 'BANK' | 'CARD';
    if (dto.referenceNo !== undefined) data.referenceNo = dto.referenceNo.trim() || null;
    if (dto.paidAt !== undefined) data.paidAt = new Date(dto.paidAt);
    if (dto.note !== undefined) data.note = dto.note.trim() || null;
    if (Object.keys(data).length === 0) throw new BadRequestException('Nothing to update.');

    const updated = await this.prisma.subscriptionPayment.update({ where: { id: paymentId }, data });

    // Keep the payer's "last payment" badge truthful when editing the latest receipt.
    if (dto.amount !== undefined) {
      const latest = await this.prisma.subscriptionPayment.findFirst({
        where: { userId: payment.userId, voidedAt: null },
        orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
        select: { id: true, amount: true },
      });
      if (latest && latest.id === paymentId) {
        await this.prisma.user.update({
          where: { id: payment.userId },
          data: { lastPaymentAmount: dec(dto.amount) },
        });
      }
    }

    await this.audit.record({
      userId: adminId,
      businessId: payment.businessId,
      action: 'admin.payment_update',
      entityType: 'SubscriptionPayment',
      entityId: paymentId,
      before: { amount: payment.amount.toString(), method: payment.method, referenceNo: payment.referenceNo, paidAt: payment.paidAt, note: payment.note },
      after: { amount: updated.amount.toString(), method: updated.method, referenceNo: updated.referenceNo, paidAt: updated.paidAt, note: updated.note },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  /**
   * Void a payment: marks `voidedAt` and reverses exactly that payment's
   * extension (never below its own `periodStart`). LIFO discipline — when a
   * newer live payment exists for the same account, void the newer one first
   * (409), otherwise the reversal would eat time the newer payment paid for.
   */
  async voidPayment(adminId: string, paymentId: string, meta: RequestMeta) {
    const payment = await this.prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found.');
    if (payment.voidedAt) throw new ConflictException('Payment is already voided.');

    const newer = await this.prisma.subscriptionPayment.findFirst({
      where: { userId: payment.userId, voidedAt: null, createdAt: { gt: payment.createdAt } },
      select: { id: true },
    });
    if (newer) {
      throw new ConflictException('A newer payment exists for this account — void it first.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payment.userId } });
    if (!user || user.deletedAt) throw new NotFoundException('Account not found.');

    const now = new Date();
    const serviceExpiresAt = reverseSubscriptionExtension(
      user.serviceExpiresAt,
      payment.periodStart,
      payment.months,
    );

    const previous = await this.prisma.subscriptionPayment.findFirst({
      where: { userId: payment.userId, voidedAt: null, id: { not: paymentId } },
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      select: { amount: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const voided = await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: { voidedAt: now },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { serviceExpiresAt, lastPaymentAmount: previous?.amount ?? null },
      });
      return voided;
    });

    await this.audit.record({
      userId: adminId,
      businessId: payment.businessId,
      action: 'admin.payment_void',
      entityType: 'SubscriptionPayment',
      entityId: paymentId,
      before: { serviceExpiresAt: user.serviceExpiresAt },
      after: { voidedAt: now, serviceExpiresAt },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    this.events.emit(DomainEvents.SubscriptionPaymentVoided, {
      userId: user.id,
      paymentId,
      at: now,
    });

    return result;
  }
}