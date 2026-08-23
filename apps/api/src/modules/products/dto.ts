import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Money/quantity inputs arrive as numbers and are converted to Decimal in the service. */
export class CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) sku?: string;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;

  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() unitId?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) costPrice?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) sellingPrice?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minPrice?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(1) taxRate?: number;

  @IsOptional() @IsBoolean() trackInventory?: boolean;
  @IsOptional() @IsBoolean() isService?: boolean;

  /** Opening stock recorded as an OPENING inventory movement. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) openingStock?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) reorderLevel?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @IsPositive() reorderQuantity?: number;

  @IsOptional() @IsString() @MaxLength(80) batchNumber?: string;
  @IsOptional() @IsString() expiryDate?: string; // ISO date
}

/** Update never moves stock — stock changes go through the inventory endpoints. */
export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) sku?: string;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;

  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() unitId?: string | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) costPrice?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) sellingPrice?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minPrice?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(1) taxRate?: number;

  @IsOptional() @IsBoolean() trackInventory?: boolean;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) reorderLevel?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @IsPositive() reorderQuantity?: number;

  @IsOptional() @IsString() @MaxLength(80) batchNumber?: string;
  @IsOptional() @IsString() expiryDate?: string;
}

export class ListProductsQuery {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() sort?: string; // name|-name|stock|-stock|price|-price|created|-created

  @IsOptional() @Type(() => Boolean) @IsBoolean() archived?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() lowStock?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) expiringInDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class ImportProductsDto {
  @IsString() csv!: string;
  /** Match existing rows by this key to update instead of insert. */
  @IsOptional() @IsString() matchBy?: 'sku' | 'barcode' | 'name';
}
