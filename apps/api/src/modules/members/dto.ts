import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MembershipRole } from '@prisma/client';

export class InviteMemberDto {
  /** Tanzanian mobile — flexible input, normalized server-side. */
  @IsString()
  @MinLength(9)
  @MaxLength(20)
  phone!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(MembershipRole)
  role!: MembershipRole;

  /** Optional invitation message. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateMemberRoleDto {
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
