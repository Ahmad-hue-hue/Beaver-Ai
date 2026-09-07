/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles: lightweight Prisma stubs, no production code affected */
import { describe, expect, test } from 'bun:test';
import * as argon2 from 'argon2';
import { AuthService } from '../auth/auth.service.js';
import { AdminService } from './admin.service.js';

const META = { ip: '127.0.0.1', userAgent: 'test' };

function makeAdminService(db: Record<string, any> = {}) {
  const auditEntries: any[] = [];
  const txCalls: any[] = [];
  const tx = {
    user: {
      update: async (args: any) => {
        txCalls.push(['user.update', args]);
        return { ...db.user, ...args.data };
      },
    },
    refreshToken: {
      updateMany: async (args: any) => {
        txCalls.push(['refreshToken.updateMany', args]);
        return { count: 2 };
      },
    },
  };
  const prisma: any = {
    user: { findUnique: async () => db.user ?? null },
    $transaction: async (fn: any) => fn(tx),
  };
  const audit = { record: async (e: any) => { auditEntries.push(e); } };
  const events = { emit: () => true };
  return { svc: new AdminService(prisma, audit as any, events as any), auditEntries, txCalls };
}

describe('AdminService.resetUserPassword', () => {
  const user = () => ({
    id: 'u-9', name: 'Zawadi', phone: '+255700000099', deletedAt: null,
  });

  test('refuses unknown accounts', async () => {
    const { svc } = makeAdminService({});
    await expect(svc.resetUserPassword('admin-1', 'ghost', META)).rejects.toThrow('User not found.');
  });

  test('refuses self-reset (use change-password instead)', async () => {
    const { svc } = makeAdminService({ user: { ...user(), id: 'admin-1' } });
    await expect(svc.resetUserPassword('admin-1', 'admin-1', META)).rejects.toThrow('change-password');
  });

  test('issues a one-time password, revokes sessions, audits without plaintext', async () => {
    const { svc, auditEntries, txCalls } = makeAdminService({ user: user() });
    const res = await svc.resetUserPassword('admin-1', 'u-9', META);

    expect(res.id).toBe('u-9');
    expect(res.temporaryPassword.length).toBeGreaterThan(8);

    const userUpdate = txCalls.find(([k]) => k === 'user.update');
    expect(userUpdate).toBeDefined();
    // The stored value is an argon2 hash of the returned password — never the plaintext.
    expect(userUpdate[1].data.passwordHash).not.toBe(res.temporaryPassword);
    expect(await argon2.verify(userUpdate[1].data.passwordHash, res.temporaryPassword)).toBe(true);

    const revoke = txCalls.find(([k]) => k === 'refreshToken.updateMany');
    expect(revoke[1].where).toMatchObject({ userId: 'u-9', revokedAt: null });

    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({ action: 'admin.user_password_reset', entityId: 'u-9' });
    expect(JSON.stringify(auditEntries[0])).not.toContain(res.temporaryPassword);
  });
});

describe('AuthService.changePassword', () => {
  async function makeAuthService(current: string) {
    const updates: any[] = [];
    const prisma: any = {
      user: {
        findUnique: async () => ({
          id: 'u-9', name: 'Zawadi', phone: '+255700000099', deletedAt: null,
          passwordHash: await argon2.hash(current, { type: argon2.argon2id }),
        }),
      },
      refreshToken: {
        updateMany: async (args: any) => {
          updates.push(args);
          return { count: 1 };
        },
      },
      $transaction: async (fn: any) =>
        fn({ user: { update: async (a: any) => { updates.push(['user.update', a]); } }, refreshToken: prisma.refreshToken }),
    };
    const tokens = {} as any;
    return { svc: new AuthService(prisma, tokens), updates };
  }

  test('rejects a wrong current password', async () => {
    const { svc } = await makeAuthService('correct-horse-1');
    await expect(
      svc.changePassword('u-9', { currentPassword: 'nope-nope-nope', newPassword: 'brand-new-pass-1' }, undefined),
    ).rejects.toThrow('Current password is incorrect.');
  });

  test('rejects reusing the current password', async () => {
    const { svc } = await makeAuthService('same-password-1');
    await expect(
      svc.changePassword('u-9', { currentPassword: 'same-password-1', newPassword: 'same-password-1' }, undefined),
    ).rejects.toThrow('different');
  });

  test('rotates the hash and keeps only the calling session', async () => {
    const { svc, updates } = await makeAuthService('old-password-1');
    await svc.changePassword(
      'u-9',
      { currentPassword: 'old-password-1', newPassword: 'brand-new-pass-2' },
      'current-opaque-refresh',
    );

    const userUpdate = updates.find((u) => Array.isArray(u) && u[0] === 'user.update');
    expect(userUpdate).toBeDefined();
    expect(await argon2.verify(userUpdate[1].data.passwordHash, 'brand-new-pass-2')).toBe(true);

    const revoke = updates.find((u) => !Array.isArray(u));
    expect(revoke.where.userId).toBe('u-9');
    // Every session except the caller's is revoked.
    expect(revoke.where.tokenHash).toEqual({ not: expect.any(String) });
  });
});
