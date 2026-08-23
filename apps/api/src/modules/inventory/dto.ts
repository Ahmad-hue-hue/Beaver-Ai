import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AdjustStockDto {
  @IsString() productId!: string;
  /** Signed: positive adds stock, negative removes it. */
  @IsNumber({ maxDecimalPlaces: 3 }) quantity!: number;
  @IsOptional() @IsString() @MaxLength(280) reason?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitCost?: number;
}

export class WriteOffDto {
  @IsString() productId!: string;
  /** Positive quantity to remove from stock. */
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) quantity!: number;
  @IsIn(['DAMAGE', 'EXPIRY', 'LOSS']) type!: 'DAMAGE' | 'EXPIRY' | 'LOSS';
  @IsOptional() @IsString() @MaxLength(280) reason?: string;
}

export class ReceiveStockDto {
  @IsString() productId!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) quantity!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitCost?: number;
  @IsOptional() @IsString() @MaxLength(280) reason?: string;
}

export class ListMovementsQuery {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

class CountItemDto {
  @IsString() productId!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) countedQty!: number;
}

export class CreateCountDto {
  @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @IsOptional() @IsString() @MaxLength(280) notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CountItemDto)
  items!: CountItemDto[];
}
