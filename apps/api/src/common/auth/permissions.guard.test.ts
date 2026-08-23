import { describe, expect, it } from 'bun:test';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '@beaver/shared';
import type { AuthenticatedUser } from './auth.types.js';
import { PermissionsGuard } from './permissions.guard.js';

/** Minimal ExecutionContext double carrying a req.user and a fixed required-permissions list. */
function contextFor(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

/** Reflector stub returning a fixed required-permissions array regardless of target. */
function reflectorReturning(required: readonly string[] | undefined): Reflector {
  return { getAllAndOverride: () => required } as unknown as Reflector;
}

const owner: AuthenticatedUser = {
  userId: 'u1',
  businessId: 'b1',
  role: 'OWNER',
  permissions: Object.values(PERMISSIONS),
  isPlatformAdmin: false,
};

const cashier: AuthenticatedUser = {
  userId: 'u2',
  businessId: 'b1',
  role: 'CASHIER',
  permissions: [PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_VIEW],
  isPlatformAdmin: false,
};

describe('PermissionsGuard', () => {
  it('allows a route with no required permissions', () => {
    const guard = new PermissionsGuard(reflectorReturning(undefined));
    expect(guard.canActivate(contextFor(cashier))).toBe(true);
  });

  it('allows when the user holds the required permission', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.SALES_CREATE]));
    expect(guard.canActivate(contextFor(cashier))).toBe(true);
  });

  it('blocks a cashier from a permission they lack (settings.manage)', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.SETTINGS_MANAGE]));
    expect(() => guard.canActivate(contextFor(cashier))).toThrow(ForbiddenException);
  });

  it('blocks a cashier from financial reports (reports.view_financial)', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.REPORTS_VIEW_FINANCIAL]));
    expect(() => guard.canActivate(contextFor(cashier))).toThrow(ForbiddenException);
  });

  it('grants an owner every permission', () => {
    for (const perm of Object.values(PERMISSIONS)) {
      const guard = new PermissionsGuard(reflectorReturning([perm]));
      expect(guard.canActivate(contextFor(owner))).toBe(true);
    }
  });

  it('throws when there is no authenticated user', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.SALES_VIEW]));
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });

  it('requires ALL listed permissions (not just one)', () => {
    const guard = new PermissionsGuard(
      reflectorReturning([PERMISSIONS.SALES_CREATE, PERMISSIONS.SETTINGS_MANAGE]),
    );
    expect(() => guard.canActivate(contextFor(cashier))).toThrow(ForbiddenException);
  });
});
