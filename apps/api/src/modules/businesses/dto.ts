import { BusinessType } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LOCALES, PAYMENT_METHODS } from '@beaver/shared';

const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS);

export class OnboardBusinessDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEnum(BusinessType)
  type!: BusinessType;

  @IsString()
  @Length(2, 2, { message: 'country must be a 2-letter ISO code' })
  country = 'TZ';

  @IsString()
  @Length(3, 3, { message: 'currency must be a 3-letter ISO code' })
  currency = 'TZS';

  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(60) taxId?: string;
  @IsOptional() @IsISO8601() openingDate?: string;
  @IsOptional() @IsBoolean() trackInventory?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PAYMENT_METHOD_VALUES, { each: true })
  defaultPaymentMethods?: string[];

  @IsOptional()
  @IsIn(LOCALES)
  defaultLocale?: string;

  @IsOptional() @IsString() @MaxLength(60) timezone?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PAYMENT_METHOD_VALUES, { each: true })
  defaultPaymentMethods?: string[];

  @IsOptional() @IsIn(LOCALES) defaultLocale?: string;
  @IsOptional() @IsString() @MaxLength(60) timezone?: string;
  @IsOptional() @IsString() @MaxLength(280) receiptFooter?: string;
  @IsOptional() @IsBoolean() allowNegativeStock?: boolean;
}
