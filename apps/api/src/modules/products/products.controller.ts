import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { ProductsService } from './products.service.js';
import {
  CreateProductDto,
  ImportProductsDto,
  ListProductsQuery,
  UpdateProductDto,
} from './dto.js';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCTS_VIEW)
  list(@BusinessId() businessId: string, @Query() query: ListProductsQuery) {
    return this.products.list(businessId, query);
  }

  @Get('export.csv')
  @RequirePermissions(PERMISSIONS.PRODUCTS_VIEW)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="products.csv"')
  export(@BusinessId() businessId: string) {
    return this.products.exportCsv(businessId);
  }

  @Post('import')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  import(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportProductsDto,
    @Req() req: Request,
  ) {
    return this.products.importCsv(businessId, user.userId, dto, this.meta(req));
  }

  @Get('barcode/:barcode')
  @RequirePermissions(PERMISSIONS.PRODUCTS_VIEW)
  byBarcode(@BusinessId() businessId: string, @Param('barcode') barcode: string) {
    return this.products.findByBarcode(businessId, barcode);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_VIEW)
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.products.findOne(businessId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  create(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
    @Req() req: Request,
  ) {
    return this.products.create(businessId, user.userId, dto, this.meta(req));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  update(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ) {
    return this.products.update(businessId, user.userId, id, dto, this.meta(req));
  }

  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  archive(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.products.setArchived(businessId, user.userId, id, true, this.meta(req));
  }

  @Post(':id/unarchive')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  unarchive(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.products.setArchived(businessId, user.userId, id, false, this.meta(req));
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  remove(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.products.remove(businessId, user.userId, id, this.meta(req));
  }
}
