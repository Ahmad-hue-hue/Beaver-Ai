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

// M4 permission surface: suppliers, purchases, expenses, cash, debts.
const m4Perms = [
  PERMISSIONS.SUPPLIERS_VIEW,
  PERMISSIONS.SUPPLIERS_MANAGE,
  PERMISSIONS.PURCHASES_VIEW,
  PERMISSIONS.PURCHASES_MANAGE,
  PERMISSIONS.EXPENSES_VIEW,
  PERMISSIONS.EXPENSES_MANAGE,
  PERMISSIONS.CASH_MANAGE,
  PERMISSIONS.DEBTS_VIEW,
  PERMISSIONS.DEBTS_MANAGE,
];

describe('M4 permissions', () => {
  it('gives owner every M4 permission', () => {
    const guard = new PermissionsGuard(reflectorReturning(m4Perms));
    expect(guard.canActivate(contextFor(actorFor('OWNER')))).toBe(true);
  });

  it('gives manager every M4 permission', () => {
    const guard = new PermissionsGuard(reflectorReturning(m4Perms));
    expect(guard.canActivate(contextFor(actorFor('MANAGER')))).toBe(true);
  });

  it('blocks a cashier from supplier management', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.SUPPLIERS_MANAGE]));
    expect(() => guard.canActivate(contextFor(actorFor('CASHIER')))).toThrow(ForbiddenException);
  });

  it('blocks a cashier from purchase management', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.PURCHASES_MANAGE]));
    expect(() => guard.canActivate(contextFor(actorFor('CASHIER')))).toThrow(ForbiddenException);
  });

  it('allows inventory staff to view suppliers and purchases but not manage them', () => {
    const staff = actorFor('INVENTORY_STAFF');
    const viewGuard = new PermissionsGuard(
      reflectorReturning([PERMISSIONS.SUPPLIERS_VIEW, PERMISSIONS.PURCHASES_VIEW]),
    );
    expect(viewGuard.canActivate(contextFor(staff))).toBe(true);

    const manageGuard = new PermissionsGuard(reflectorReturning([PERMISSIONS.PURCHASES_MANAGE]));
    expect(() => manageGuard.canActivate(contextFor(staff))).toThrow(ForbiddenException);
  });

  it('blocks a cashier from expense management', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.EXPENSES_MANAGE]));
    expect(() => guard.canActivate(contextFor(actorFor('CASHIER')))).toThrow(ForbiddenException);
  });

  it('blocks a cashier from cash management', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.CASH_MANAGE]));
    expect(() => guard.canActivate(contextFor(actorFor('INVENTORY_STAFF')))).toThrow(ForbiddenException);
  });

  it('blocks debt management from inventory staff', () => {
    const guard = new PermissionsGuard(reflectorReturning([PERMISSIONS.DEBTS_MANAGE]));
    expect(() => guard.canActivate(contextFor(actorFor('INVENTORY_STAFF')))).toThrow(ForbiddenException);
  });
});
