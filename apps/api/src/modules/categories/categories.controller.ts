import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, RequirePermissions } from '../../common/auth/decorators.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto.js';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCTS_VIEW)
  list(@BusinessId() businessId: string) {
    return this.categories.list(businessId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  create(@BusinessId() businessId: string, @Body() dto: CreateCategoryDto) {
    return this.categories.create(businessId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  update(@BusinessId() businessId: string, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(businessId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.categories.remove(businessId, id);
  }
}
