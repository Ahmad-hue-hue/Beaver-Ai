import { IsIn, IsOptional, IsISO8601 } from 'class-validator';
import { PLAN_KEYS } from '@beaver/shared';

export class ChangePlanDto {
  @IsIn(PLAN_KEYS)
  plan!: string;
}

export class StartTrialDto {
  @IsOptional()
  @IsISO8601()
  /** Override end date — mainly for tests/dev. Defaults to now + 14 days. */
  endsAt?: string;
}
