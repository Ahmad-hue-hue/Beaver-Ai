import {
  IsBoolean,
  IsDateString,
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
import { BusinessType, PaymentMethod } from '@prisma/client';

/** Edit a platform account. Password hashes are never readable or writable here. */
export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsBoolean() isPlatformAdmin?: boolean;
  /** ISO date — grants approval when set. */
  @IsOptional() @IsDateString() approvedAt?: string;
  /** ISO date — manual expiry correction (audited). */
  @IsOptional() @IsDateString() serviceExpiresAt?: string;
}

/** Edit a business profile. */
export class UpdateBusinessDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsEnum(BusinessType) type?: string;
  @IsOptional() @IsString() @MaxLength(8) country?: string;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
}

/**
 * Record a subscription payment. Recording extends the payer's
 * `serviceExpiresAt` by `months` × 30 days (never shortens an active month)
 * and stamps `approvedAt` when the account was pending.
 */
export class RecordPaymentDto {
  @IsString() userId!: string;
  @IsOptional() @IsString() businessId?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @IsOptional() @IsEnum(PaymentMethod) method?: string;
  @IsOptional() @IsString() @MaxLength(120) referenceNo?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) months?: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/**
 * Correct a payment record. `months` and the granted period are immutable —
 * a wrong duration is fixed by voiding and re-recording, so the money trail
 * always shows what was actually granted and reversed.
 */
export class UpdatePaymentDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount?: number;
  @IsOptional() @IsEnum(PaymentMethod) method?: string;
  @IsOptional() @IsString() @MaxLength(120) referenceNo?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class ListPaymentsQuery {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() includeVoided?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() cursor?: string;
}
