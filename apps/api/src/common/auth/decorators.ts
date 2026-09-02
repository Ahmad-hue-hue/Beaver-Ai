import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import type { Permission } from '@beaver/shared';
import type { AuthenticatedUser } from './auth.types.js';

/** Marks a route as not requiring authentication. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Declares the permissions required to access a route (all must be held). */
export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);

/** Injects the authenticated user (req.user). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);

/** Injects the active businessId, throwing if the session isn't scoped to a business yet. */
export const BusinessId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const businessId = req.user?.businessId as string | null | undefined;
    if (!businessId) {
      throw new ForbiddenException('No active business. Complete onboarding or select a business.');
    }
    return businessId;
  },
);
