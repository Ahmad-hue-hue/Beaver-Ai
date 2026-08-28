import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CashMovementType } from '@prisma/client';

export class OpenCashSessionDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) openingBalance!: number;
  @IsOptional() @IsString() @MaxLength(500) openingNotes?: string;
}

export class CloseCashSessionDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) countedCash!: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class ListCashMovementsQuery {
  @IsOptional() @IsString() sessionId?: string;
  @IsOptional() @IsEnum(CashMovementType) type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
