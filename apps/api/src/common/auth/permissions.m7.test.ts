import { describe, expect, it } from 'bun:test';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS, ROLE_PERMISSIONS } from '@beaver/shared';
import type { AuthenticatedUser } from './auth.types.js';
import { PermissionsGuard } from './permissions.guard.js';

function contextFor(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}
function reflectorReturning(required: readonly string[] | undefined): Reflector {
  return { getAllAndOverride: () => required } as unknown as Reflector;
}
function actorFor(role: 'OWNER' | 'CASHIER' | 'INVENTORY_STAFF' | 'MANAGER'): AuthenticatedUser {
  return {
    userId: 'u1',
    businessId: 'b1',
    role,
    permissions: ROLE_PERMISSIONS[role],
    isPlatformAdmin: false,
  };
}

describe('M7 permissions', () => {
  it('allows every role to view notifications', () => {
    for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'INVENTORY_STAFF'] as const) {
      const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.NOTIFICATIONS_VIEW]));
      expect(guard.canActivate(contextFor(actorFor(role)))).toBe(true);
    }
  });

  it('owner can manage employees and manager can only view them', () => {
    const view = new PermissionsGuard(reflectorReturning([PERMISSIONS.EMPLOYEES_VIEW]));
    const manage = new PermissionsGuard(reflectorReturning([PERMISSIONS.EMPLOYEES_MANAGE]));
    expect(manage.canActivate(contextFor(actorFor('OWNER')))).toBe(true);
    expect(view.canActivate(contextFor(actorFor('OWNER')))).toBe(true);
    expect(view.canActivate(contextFor(actorFor('MANAGER')))).toBe(true);
    expect(() => manage.canActivate(contextFor(actorFor('MANAGER')))).toThrow(ForbiddenException);
  });

  it('blocks a cashier from employee management', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.EMPLOYEES_MANAGE]));
    expect(() => guard.canActivate(contextFor(actorFor('CASHIER')))).toThrow(ForbiddenException);
  });

  it('blocks inventory staff from employee management', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.EMPLOYEES_MANAGE]));
    expect(() => guard.canActivate(contextFor(actorFor('INVENTORY_STAFF')))).toThrow(ForbiddenException);
  });
});
