import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@beaver/shared';
import { MembershipStatus } from '@prisma/client';
import { BusinessId, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { MembersService } from './members.service.js';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto.js';

@ApiTags('members')
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_VIEW)
  list(@BusinessId() businessId: string) {
    return this.members.list(businessId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  invite(@BusinessId() businessId: string, @Body() dto: InviteMemberDto) {
    return this.members.invite(businessId, dto);
  }

  @Patch(':id/role')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  updateRole(
    @BusinessId() businessId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.members.updateRole(businessId, actor.userId, id, dto);
  }

  @Post(':id/suspend')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  suspend(
    @BusinessId() businessId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.members.setStatus(businessId, actor.userId, id, MembershipStatus.SUSPENDED);
  }

  @Post(':id/reactivate')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  reactivate(
    @BusinessId() businessId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.members.setStatus(businessId, actor.userId, id, MembershipStatus.ACTIVE);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  remove(
    @BusinessId() businessId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.members.remove(businessId, actor.userId, id);
  }
}
