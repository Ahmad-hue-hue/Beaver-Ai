import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';

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

const SERVICE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
          where: { deletedAt: null, approvedAt: { not: null }, OR: [
            { serviceExpiresAt: null },
            { serviceExpiresAt: { lte: new Date() } },
          ] },
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
          select: { id: true, name: true, email: true, isPlatformAdmin: true, approvedAt: true, createdAt: true },
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
        { email: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
        { memberships: { some: { user: { OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
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
          email: true,
          createdAt: true,
          memberships: {
            where: { status: 'ACTIVE' },
            select: {
              role: true,
              user: { select: { id: true, name: true, email: true, approvedAt: true, serviceExpiresAt: true } },
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
          email: b.email,
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
        { email: { contains: search, mode: 'insensitive' as const } },
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
        email: true,
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
      { serviceExpiresAt: null },
      { serviceExpiresAt: { lte: new Date() } },
    ];

    const where: Prisma.UserWhereInput = { deletedAt: null, OR: needsAttention };
    if (search) {
      where.AND = [
        { OR: needsAttention },
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
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
        email: true,
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
    const base = user.serviceExpiresAt && user.serviceExpiresAt.getTime() > now.getTime()
      ? user.serviceExpiresAt
      : now;
    const serviceExpiresAt = new Date(base.getTime() + SERVICE_MONTH_MS);

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
    const base = user.serviceExpiresAt && user.serviceExpiresAt.getTime() > now.getTime()
      ? user.serviceExpiresAt
      : now;
    const serviceExpiresAt = new Date(base.getTime() + SERVICE_MONTH_MS);

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
        user: { select: { id: true, name: true, email: true } },
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
}