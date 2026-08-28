import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { MembershipRole, MembershipStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto.js';

const MEMBERSHIP_ROLES: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.MANAGER,
  MembershipRole.CASHIER,
  MembershipRole.INVENTORY_STAFF,
];

export function tempPassword(): string {
  return randomBytes(9).toString('base64url');
}

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { businessId },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: [{ role: 'asc' as const }, { createdAt: 'asc' as const }],
    });
    return memberships.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      phone: m.user.phone,
      role: m.role,
      status: m.status,
      extraPermissions: m.extraPermissions,
    }));
  }

  /** Invite a person to the business as a member. Returns an auto-generated password for a brand-new account. */
  async invite(businessId: string, dto: InviteMemberDto) {
    const email = dto.email.toLowerCase().trim();
    if (!MEMBERSHIP_ROLES.includes(dto.role)) {
      throw new BadRequestException('Invalid role.');
    }

    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      let newPassword: string | null = null;

      if (!user) {
        newPassword = tempPassword();
        user = await tx.user.create({
          data: {
            email,
            name: dto.name.trim(),
            passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }),
          },
        });
      }

      const existing = await tx.membership.findUnique({
        where: { userId_businessId: { userId: user.id, businessId } },
      });
      if (existing) throw new ConflictException('That person is already a member of this business.');

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          businessId,
          role: dto.role,
          status: MembershipStatus.ACTIVE,
        },
      });

      return {
        membershipId: membership.id,
        userId: user.id,
        role: dto.role,
        account: newPassword ? 'created' : 'existing',
        temporaryPassword: newPassword, // shown once; share with the new member (no SMTP yet)
      };
    });
  }

  async updateRole(businessId: string, actorUserId: string, membershipId: string, dto: UpdateMemberRoleDto) {
    const membership = await this.requireMembership(businessId, membershipId);

    if (membership.role === MembershipRole.OWNER && dto.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('An owner account cannot be demoted. Transfer ownership first.');
    }
    if (membership.role !== MembershipRole.OWNER && dto.role === MembershipRole.OWNER) {
      throw new ForbiddenException('Use the ownership-transfer flow to promote a new owner.');
    }
    if (membership.userId === actorUserId && dto.role !== membership.role && membership.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    return this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: dto.role },
      select: { id: true, role: true, status: true },
    });
  }

  async setStatus(businessId: string, actorUserId: string, membershipId: string, status: MembershipStatus) {
    const membership = await this.requireMembership(businessId, membershipId);
    if (membership.role === MembershipRole.OWNER) {
      throw new ForbiddenException('An owner account cannot be suspended.');
    }
    if (membership.userId === actorUserId && status === MembershipStatus.SUSPENDED) {
      throw new ForbiddenException('You cannot suspend yourself.');
    }
    return this.prisma.membership.update({
      where: { id: membershipId },
      data: { status },
      select: { id: true, role: true, status: true },
    });
  }

  async remove(businessId: string, actorUserId: string, membershipId: string) {
    const membership = await this.requireMembership(businessId, membershipId);
    if (membership.role === MembershipRole.OWNER) {
      throw new ForbiddenException('The owner cannot be removed.');
    }
    if (membership.userId === actorUserId) {
      throw new ForbiddenException('You cannot remove yourself. Ask the owner.');
    }
    // Keep the user row; just drop the membership link.
    await this.prisma.membership.delete({ where: { id: membershipId } });
    return { ok: true };
  }

  private async requireMembership(businessId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, businessId },
    });
    if (!membership) throw new NotFoundException('Member not found.');
    return membership;
  }
}
