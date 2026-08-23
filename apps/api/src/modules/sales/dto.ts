import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

/** One cart line. Quantities/prices arrive as numbers and become Decimal in the service. */
export class SaleItemInput {
  @IsString() productId!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantity!: number;
  /** Overrides the product's selling price (must stay ≥ the product's minPrice). */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice?: number;
  /** Per-line discount amount (absolute). */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discount?: number;
}

/** A real tender. CREDIT is not a tender — an unpaid remainder becomes the customer's debt. */
export class PaymentInput {
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount!: number;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}

export class CreateSaleDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemInput)
  items!: SaleItemInput[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentInput)
  payments?: PaymentInput[];

  @IsOptional() @IsString() customerId?: string;
  /** Post-tax header discount applied to the whole sale. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discount?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  /** Client-supplied key that makes retries idempotent (safe offline re-send). */
  @IsOptional() @IsString() @MaxLength(100) idempotencyKey?: string;
}

export class ListSalesQuery {
  @IsOptional() @IsString() from?: string; // ISO date/datetime
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() cashierId?: string;
  @IsOptional() @IsString() period?: string; // today|week|month (overrides from/to when set)
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class ReturnItemInput {
  @IsString() saleItemId!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantity!: number;
}

export class CreateReturnDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReturnItemInput)
  items!: ReturnItemInput[];
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class SalesSummaryQuery {
  @IsOptional() @IsString() period?: string; // today (default) | week | month
}
