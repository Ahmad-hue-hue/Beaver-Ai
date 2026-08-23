import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMeta } from '../auth/auth.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { parseCsvObjects, toCsv } from '../../common/csv/csv.js';
import type { CreateProductDto, ImportProductsDto, ListProductsQuery, UpdateProductDto } from './dto.js';

const dec = (v: number | string): Prisma.Decimal => new Prisma.Decimal(String(v));

type SortKey = 'name' | 'stock' | 'price' | 'created';
const SORTS: Record<SortKey, string> = {
  name: 'name',
  stock: 'stockQuantity',
  price: 'sellingPrice',
  created: 'createdAt',
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────── Reads ───────────────────────────

  async list(businessId: string, q: ListProductsQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const where: Prisma.ProductWhereInput = {
      businessId,
      deletedAt: null,
      isArchived: q.archived ?? false,
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    };

    if (q.search?.trim()) {
      const s = q.search.trim();
      // trgm GIN index accelerates the ILIKE (contains) on name; codes match exactly.
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { sku: { equals: s, mode: 'insensitive' } },
        { barcode: { equals: s } },
      ];
    }

    if (q.expiringInDays !== undefined) {
      const cutoff = new Date(Date.now() + q.expiringInDays * 86_400_000);
      where.expiryDate = { not: null, lte: cutoff };
    }

    // Column-to-column comparison (stock ≤ reorderLevel) isn't expressible in Prisma `where`;
    // resolve the low-stock id set via a raw query, then constrain.
    if (q.lowStock) {
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product"
        WHERE "businessId" = ${businessId}
          AND "deletedAt" IS NULL
          AND "reorderLevel" > 0
          AND "stockQuantity" <= "reorderLevel"`;
      where.id = { in: rows.map((r) => r.id) };
    }

    const sortKey = (q.sort?.replace(/^-/, '') ?? 'name') as SortKey;
    const dir: Prisma.SortOrder = q.sort?.startsWith('-') ? 'desc' : 'asc';
    const orderBy = { [SORTS[sortKey] ?? 'name']: dir } as Prisma.ProductOrderByWithRelationInput;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, abbreviation: true } },
        },
      }),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findOne(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, abbreviation: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  /** POS barcode scan → exact, non-archived, in-stock-eligible product. */
  async findByBarcode(businessId: string, barcode: string) {
    const product = await this.prisma.product.findFirst({
      where: { businessId, barcode, deletedAt: null, isArchived: false },
      include: { unit: { select: { abbreviation: true } } },
    });
    if (!product) throw new NotFoundException('No product with that barcode.');
    return product;
  }

  // ─────────────────────────── Writes ───────────────────────────

  async create(businessId: string, userId: string, dto: CreateProductDto, meta: RequestMeta) {
    await this.assertRefs(businessId, dto.categoryId, dto.unitId);
    const opening = dto.openingStock ? dec(dto.openingStock) : new Prisma.Decimal(0);
    const isService = dto.isService ?? false;

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          businessId,
          name: dto.name.trim(),
          description: dto.description ?? null,
          sku: dto.sku?.trim() || null,
          barcode: dto.barcode?.trim() || null,
          imageUrl: dto.imageUrl ?? null,
          categoryId: dto.categoryId ?? null,
          unitId: dto.unitId ?? null,
          costPrice: dec(dto.costPrice ?? 0),
          sellingPrice: dec(dto.sellingPrice ?? 0),
          minPrice: dto.minPrice !== undefined ? dec(dto.minPrice) : null,
          taxRate: dec(dto.taxRate ?? 0),
          trackInventory: isService ? false : dto.trackInventory ?? true,
          isService,
          stockQuantity: isService ? new Prisma.Decimal(0) : opening,
          reorderLevel: dec(dto.reorderLevel ?? 0),
          reorderQuantity: dto.reorderQuantity !== undefined ? dec(dto.reorderQuantity) : null,
          batchNumber: dto.batchNumber ?? null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        },
      });

      if (!isService && opening.greaterThan(0)) {
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: created.id,
            type: 'OPENING',
            quantity: opening,
            balanceAfter: opening,
            unitCost: created.costPrice,
            reason: 'Opening stock',
            sourceType: 'Product',
            sourceId: created.id,
            userId,
          },
        });
      }

      await this.audit.record(
        {
          businessId,
          userId,
          action: 'product.create',
          entityType: 'Product',
          entityId: created.id,
          after: { name: created.name, sku: created.sku, sellingPrice: created.sellingPrice },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
      return created;
    }).catch((e) => {
      throw this.mapDuplicate(e);
    });

    return product;
  }

  async update(businessId: string, userId: string, id: string, dto: UpdateProductDto, meta: RequestMeta) {
    const existing = await this.findOne(businessId, id);
    if (dto.categoryId || dto.unitId) await this.assertRefs(businessId, dto.categoryId ?? undefined, dto.unitId ?? undefined);

    const data: Prisma.ProductUpdateInput = {
      name: dto.name?.trim(),
      description: dto.description ?? undefined,
      sku: dto.sku !== undefined ? dto.sku.trim() || null : undefined,
      barcode: dto.barcode !== undefined ? dto.barcode.trim() || null : undefined,
      imageUrl: dto.imageUrl ?? undefined,
      costPrice: dto.costPrice !== undefined ? dec(dto.costPrice) : undefined,
      sellingPrice: dto.sellingPrice !== undefined ? dec(dto.sellingPrice) : undefined,
      minPrice: dto.minPrice !== undefined ? dec(dto.minPrice) : undefined,
      taxRate: dto.taxRate !== undefined ? dec(dto.taxRate) : undefined,
      trackInventory: dto.trackInventory,
      reorderLevel: dto.reorderLevel !== undefined ? dec(dto.reorderLevel) : undefined,
      reorderQuantity: dto.reorderQuantity !== undefined ? dec(dto.reorderQuantity) : undefined,
      batchNumber: dto.batchNumber ?? undefined,
      expiryDate: dto.expiryDate !== undefined ? new Date(dto.expiryDate) : undefined,
    };
    if (dto.categoryId !== undefined) data.category = dto.categoryId ? { connect: { id: dto.categoryId } } : { disconnect: true };
    if (dto.unitId !== undefined) data.unit = dto.unitId ? { connect: { id: dto.unitId } } : { disconnect: true };

    const updated = await this.prisma.product
      .update({ where: { id }, data })
      .catch((e) => {
        throw this.mapDuplicate(e);
      });

    // Price changes are financially sensitive → always audited.
    const priceChanged =
      (dto.sellingPrice !== undefined && !existing.sellingPrice.equals(updated.sellingPrice)) ||
      (dto.costPrice !== undefined && !existing.costPrice.equals(updated.costPrice));
    await this.audit.record({
      businessId,
      userId,
      action: priceChanged ? 'product.price_change' : 'product.update',
      entityType: 'Product',
      entityId: id,
      before: { costPrice: existing.costPrice, sellingPrice: existing.sellingPrice, name: existing.name },
      after: { costPrice: updated.costPrice, sellingPrice: updated.sellingPrice, name: updated.name },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async setArchived(businessId: string, userId: string, id: string, archived: boolean, meta: RequestMeta) {
    await this.findOne(businessId, id);
    const updated = await this.prisma.product.update({ where: { id }, data: { isArchived: archived } });
    await this.audit.record({
      businessId,
      userId,
      action: archived ? 'product.archive' : 'product.unarchive',
      entityType: 'Product',
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  async remove(businessId: string, userId: string, id: string, meta: RequestMeta) {
    await this.findOne(businessId, id);
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date(), isArchived: true } });
    await this.audit.record({
      businessId,
      userId,
      action: 'product.delete',
      entityType: 'Product',
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { success: true };
  }

  // ─────────────────────────── CSV ───────────────────────────

  private static readonly CSV_HEADERS = [
    'name', 'sku', 'barcode', 'category', 'unit', 'costPrice', 'sellingPrice',
    'minPrice', 'taxRate', 'stockQuantity', 'reorderLevel', 'reorderQuantity',
    'batchNumber', 'expiryDate', 'trackInventory', 'isService', 'isArchived',
  ];

  async exportCsv(businessId: string): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { category: { select: { name: true } }, unit: { select: { name: true } } },
    });
    const rows: (string | number | null)[][] = [ProductsService.CSV_HEADERS];
    for (const p of products) {
      rows.push([
        p.name, p.sku, p.barcode, p.category?.name ?? '', p.unit?.name ?? '',
        p.costPrice.toString(), p.sellingPrice.toString(), p.minPrice?.toString() ?? '',
        p.taxRate.toString(), p.stockQuantity.toString(), p.reorderLevel.toString(),
        p.reorderQuantity?.toString() ?? '', p.batchNumber ?? '',
        p.expiryDate ? p.expiryDate.toISOString().slice(0, 10) : '',
        String(p.trackInventory), String(p.isService), String(p.isArchived),
      ]);
    }
    return toCsv(rows);
  }

  async importCsv(businessId: string, userId: string, dto: ImportProductsDto, meta: RequestMeta) {
    const rows = parseCsvObjects(dto.csv);
    const matchBy = dto.matchBy ?? 'sku';
    let created = 0;
    let updated = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const name = r.name?.trim();
      if (!name) {
        errors.push({ row: i + 2, message: 'Missing name.' });
        continue;
      }
      try {
        const categoryId = r.category ? await this.resolveCategory(businessId, r.category.trim()) : null;
        const unitId = r.unit ? await this.resolveUnit(businessId, r.unit.trim()) : null;

        const data = {
          businessId,
          name,
          sku: r.sku?.trim() || null,
          barcode: r.barcode?.trim() || null,
          categoryId,
          unitId,
          costPrice: dec(r.costPrice || 0),
          sellingPrice: dec(r.sellingPrice || 0),
          minPrice: r.minPrice ? dec(r.minPrice) : null,
          taxRate: dec(r.taxRate || 0),
          reorderLevel: dec(r.reorderLevel || 0),
          reorderQuantity: r.reorderQuantity ? dec(r.reorderQuantity) : null,
          batchNumber: r.batchNumber?.trim() || null,
          expiryDate: r.expiryDate ? new Date(r.expiryDate) : null,
          trackInventory: r.trackInventory ? r.trackInventory !== 'false' : true,
          isService: r.isService === 'true',
        };

        const matchVal = matchBy === 'name' ? name : r[matchBy]?.trim();
        const existing = matchVal
          ? await this.prisma.product.findFirst({
              where: { businessId, deletedAt: null, [matchBy]: matchVal } as Prisma.ProductWhereInput,
              select: { id: true },
            })
          : null;

        if (existing) {
          await this.prisma.product.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          const stock = dec(r.stockQuantity || 0);
          await this.prisma.$transaction(async (tx) => {
            const p = await tx.product.create({ data: { ...data, stockQuantity: data.isService ? new Prisma.Decimal(0) : stock } });
            if (!data.isService && stock.greaterThan(0)) {
              await tx.inventoryMovement.create({
                data: {
                  businessId, productId: p.id, type: 'OPENING', quantity: stock,
                  balanceAfter: stock, unitCost: p.costPrice, reason: 'CSV import opening stock',
                  sourceType: 'Import', sourceId: p.id, userId,
                },
              });
            }
          });
          created++;
        }
      } catch (e) {
        errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Failed to import row.' });
      }
    }

    await this.audit.record({
      businessId,
      userId,
      action: 'product.import',
      entityType: 'Product',
      after: { created, updated, errors: errors.length },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { created, updated, errors };
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private async resolveCategory(businessId: string, name: string): Promise<string> {
    const existing = await this.prisma.category.findFirst({ where: { businessId, name, deletedAt: null }, select: { id: true } });
    if (existing) return existing.id;
    const created = await this.prisma.category.create({ data: { businessId, name } });
    return created.id;
  }

  private async resolveUnit(businessId: string, name: string): Promise<string> {
    const existing = await this.prisma.unit.findFirst({ where: { businessId, name }, select: { id: true } });
    if (existing) return existing.id;
    const created = await this.prisma.unit.create({ data: { businessId, name, abbreviation: name.slice(0, 12) } });
    return created.id;
  }

  private async assertRefs(businessId: string, categoryId?: string, unitId?: string) {
    if (categoryId) {
      const c = await this.prisma.category.findFirst({ where: { id: categoryId, businessId, deletedAt: null }, select: { id: true } });
      if (!c) throw new NotFoundException('Category not found.');
    }
    if (unitId) {
      const u = await this.prisma.unit.findFirst({ where: { id: unitId, businessId }, select: { id: true } });
      if (!u) throw new NotFoundException('Unit not found.');
    }
  }

  private mapDuplicate(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = (e.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      if (target.includes('sku')) return new ConflictException('A product with this SKU already exists.');
      if (target.includes('barcode')) return new ConflictException('A product with this barcode already exists.');
      return new ConflictException('A product with these details already exists.');
    }
    return e as Error;
  }
}
