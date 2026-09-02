import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.types.js';

/** Restricts a route (or controller) to the platform (SaaS-owner) admin, not a per-business role. */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (req.user?.isPlatformAdmin) return true;
    throw new ForbiddenException('Platform admin access required.');
  }
}