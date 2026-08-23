import { describe, expect, it } from 'bun:test';
import { PERMISSIONS, permissionsForRole } from '@beaver/shared';
import { TokenService } from './token.service.js';

describe('TokenService.resolvePermissions', () => {
  it('returns no permissions for a null role and no extras', () => {
    expect(TokenService.resolvePermissions(null)).toEqual([]);
  });

  it('returns the role defaults for a role with no extras', () => {
    const resolved = TokenService.resolvePermissions('CASHIER');
    expect(resolved.sort()).toEqual([...permissionsForRole('CASHIER')].sort());
  });

  it('unions role defaults with extra grants', () => {
    const resolved = TokenService.resolvePermissions('CASHIER', [PERMISSIONS.SETTINGS_MANAGE]);
    expect(resolved).toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(resolved).toContain(PERMISSIONS.SALES_CREATE); // still has role defaults
  });

  it('de-duplicates when an extra grant overlaps a role default', () => {
    const resolved = TokenService.resolvePermissions('CASHIER', [PERMISSIONS.SALES_CREATE]);
    const occurrences = resolved.filter((p) => p === PERMISSIONS.SALES_CREATE).length;
    expect(occurrences).toBe(1);
  });

  it('grants an owner every defined permission', () => {
    const resolved = new Set(TokenService.resolvePermissions('OWNER'));
    for (const perm of Object.values(PERMISSIONS)) {
      expect(resolved.has(perm)).toBe(true);
    }
  });
});
