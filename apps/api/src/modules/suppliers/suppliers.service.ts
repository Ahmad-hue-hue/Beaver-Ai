import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMeta } from '../auth/auth.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CreateSupplierDto, ListSuppliersQuery } from './dto.js';

/**
 * Supplier directory for M4. References purchase documents, so removal is a soft delete
 * (deletedAt) rather than a physical delete — a supplier with history keeps its rows.
 */
@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(businessId: string, q: ListSuppliersQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const where: Prisma.SupplierWhereInput = { businessId, deletedAt: null };
    if (q.search?.trim()) {
      const s = q.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { purchases: true } } },
      }),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async findOne(businessId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, businessId, deletedAt: null },
      include: { _count: { select: { purchases: true } } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');
    return supplier;
  }

  async create(businessId: string, userId: string, dto: CreateSupplierDto, meta: RequestMeta) {
    const supplier = await this.prisma.supplier.create({
      data: {
        businessId,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        address: dto.address?.trim() || null,
        note: dto.note?.trim() || null,
      },
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'supplier.create',
      entityType: 'Supplier',
      entityId: supplier.id,
      after: { name: supplier.name },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return supplier;
  }

  async update(
    businessId: string,
    userId: string,
    id: string,
    dto: Partial<CreateSupplierDto>,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.supplier.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Supplier not found.');

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
        email: dto.email !== undefined ? dto.email?.trim() || null : undefined,
        address: dto.address !== undefined ? dto.address?.trim() || null : undefined,
        note: dto.note !== undefined ? dto.note?.trim() || null : undefined,
      },
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'supplier.update',
      entityType: 'Supplier',
      entityId: supplier.id,
      before: { name: existing.name },
      after: { name: supplier.name },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return supplier;
  }

  async remove(businessId: string, userId: string, id: string, meta: RequestMeta) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!supplier) throw new NotFoundException('Supplier not found.');

    const purchaseCount = await this.prisma.purchase.count({ where: { supplierId: id } });
    if (purchaseCount > 0) {
      throw new BadRequestException(
        'This supplier has purchase history and cannot be deleted. Disable them instead by editing the record.',
      );
    }

    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'supplier.remove',
      entityType: 'Supplier',
      entityId: supplier.id,
      before: { name: supplier.name },
      after: { deletedAt: new Date().toISOString() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: supplier.id, deletedAt: supplier.deletedAt };
  }
}
