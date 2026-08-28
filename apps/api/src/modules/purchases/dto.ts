import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseItemDto {
  @IsString() @MinLength(1) productId!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitCost!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discount?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(0.9999) taxRate?: number;
}

export class CreatePurchaseDto {
  @IsString() @MinLength(1) supplierId!: string;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discount?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) paidAmount?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseItemDto) items!: PurchaseItemDto[];
}

export class ListPurchasesQuery {
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsEnum(['DRAFT', 'RECEIVED', 'CANCELLED']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
