import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMeta } from '../auth/auth.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CreateCustomerDto, ListCustomersQuery } from './dto.js';

const dec = (v: number | string): Prisma.Decimal => new Prisma.Decimal(String(v));

/**
 * Minimal customer directory for M3 — enough to attach a customer to a POS sale and carry a
 * running credit `balance`. Full CRUD, statements, payments and debt-aging arrive in M4.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(businessId: string, q: ListCustomersQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const where: Prisma.CustomerWhereInput = { businessId, deletedAt: null };
    if (q.search?.trim()) {
      const s = q.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async findOne(businessId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Customer not found.');
    return customer;
  }

  async create(businessId: string, userId: string, dto: CreateCustomerDto, meta: RequestMeta) {
    const customer = await this.prisma.customer.create({
      data: {
        businessId,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        note: dto.note?.trim() || null,
        creditLimit: dto.creditLimit !== undefined ? dec(dto.creditLimit) : null,
      },
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'customer.create',
      entityType: 'Customer',
      entityId: customer.id,
      after: { name: customer.name },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return customer;
  }
}
