import { describe, expect, it } from 'bun:test';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from './auth.types.js';
import { PlatformAdminGuard } from './platform-admin.guard.js';

/** Minimal ExecutionContext double carrying a req.user. */
function contextFor(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const nonAdmin: AuthenticatedUser = {
  userId: 'u1',
  businessId: 'b1',
  role: 'OWNER',
  permissions: ['sales.create'],
  isPlatformAdmin: false,
};

const platformAdmin: AuthenticatedUser = {
  ...nonAdmin,
  userId: 'u2',
  isPlatformAdmin: true,
};

describe('PlatformAdminGuard', () => {
  it('allows a platform admin', () => {
    const guard = new PlatformAdminGuard();
    expect(guard.canActivate(contextFor(platformAdmin))).toBe(true);
  });

  it('blocks an ordinary business owner, even with every business permission', () => {
    const guard = new PlatformAdminGuard();
    expect(() => guard.canActivate(contextFor(nonAdmin))).toThrow(ForbiddenException);
  });

  it('blocks a business cashier', () => {
    const guard = new PlatformAdminGuard();
    const cashier: AuthenticatedUser = {
      ...nonAdmin,
      role: 'CASHIER',
      permissions: ['sales.create'],
    };
    expect(() => guard.canActivate(contextFor(cashier))).toThrow(ForbiddenException);
  });

  it('throws when there is no authenticated user', () => {
    const guard = new PlatformAdminGuard();
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});