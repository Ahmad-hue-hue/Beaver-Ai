import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Categories with a live product count, ordered by name. */
  async list(businessId: string) {
    const rows = await this.prisma.category.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    return rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
  }

  async create(businessId: string, dto: CreateCategoryDto) {
    if (dto.parentId) await this.assertOwnedCategory(businessId, dto.parentId);
    try {
      return await this.prisma.category.create({
        data: { businessId, name: dto.name.trim(), parentId: dto.parentId ?? null },
      });
    } catch (e) {
      throw this.mapDuplicate(e);
    }
  }

  async update(businessId: string, id: string, dto: UpdateCategoryDto) {
    await this.assertOwnedCategory(businessId, id);
    if (dto.parentId) {
      if (dto.parentId === id) throw new BadRequestException('A category cannot be its own parent.');
      await this.assertOwnedCategory(businessId, dto.parentId);
    }
    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          parentId: dto.parentId === undefined ? undefined : dto.parentId,
        },
      });
    } catch (e) {
      throw this.mapDuplicate(e);
    }
  }

  /** Soft-delete. Products keep their (now dangling) categoryId; listing filters deleted out. */
  async remove(businessId: string, id: string) {
    await this.assertOwnedCategory(businessId, id);
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  private async assertOwnedCategory(businessId: string, id: string) {
    const found = await this.prisma.category.findFirst({
      where: { id, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Category not found.');
  }

  private mapDuplicate(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('A category with this name already exists.');
    }
    return e as Error;
  }
}
