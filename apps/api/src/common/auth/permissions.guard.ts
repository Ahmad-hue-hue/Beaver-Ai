import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@beaver/shared';
import type { AuthenticatedUser } from './auth.types.js';
import { PERMISSIONS_KEY } from './decorators.js';

/**
 * Enforces @RequirePermissions(...). Runs after JwtAuthGuard, so req.user is present.
 * Permission checks (not role checks) are the authorization source of truth.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException('Not authenticated.');

    const held = new Set(user.permissions);
    const missing = required.filter((p) => !held.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    return true;
  }
}
