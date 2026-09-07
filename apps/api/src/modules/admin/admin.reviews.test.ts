/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles: lightweight Prisma stubs, no production code affected */
import { describe, expect, test } from 'bun:test';
import { AdminService } from './admin.service.js';

/**
 * AdminService review-flow tests (approve / renew / reject).
 * The Prisma layer is stubbed — these verify service branching, expiry math
 * wiring, guardrails and audit payloads without touching a database.
 */

const META = { ip: '127.0.0.1', userAgent: 'test' };
const MONTH = 30 * 24 * 60 * 60 * 1000;

interface Stub {
  prisma: any;
  audit: { entries: any[]; record: (e: any) => Promise<void> };
  events: { emitted: any[]; emit: (...a: any[]) => boolean };
  calls: { findManyArgs: any[]; updates: any[] };
}

function makeService(userRow: any, extra: Record<string, any> = {}): { svc: AdminService; stub: Stub } {
  const calls: Stub['calls'] = { findManyArgs: [], updates: [] };
  const auditEntries: any[] = [];
  const emitted: any[] = [];
  const tx = {
    user: {
      update: async (args: any) => {
        calls.updates.push(args);
        return { ...userRow, ...args.data };
      },
    },
  };
  const prisma: any = {
    user: {
      findUnique: async () => userRow,
      findMany: async (args: any) => {
        calls.findManyArgs.push(args);
        return extra.rows ?? [];
      },
      update: async (args: any) => {
        calls.updates.push(args);
        return { ...userRow, ...args.data };
      },
      count: async () => extra.count ?? 0,
    },
    $transaction: async (fn: any) => fn(tx),
    ...extra.models,
  };
  const audit = { entries: auditEntries, record: async (e: any) => { auditEntries.push(e); } };
  const events = { emitted, emit: (...a: any[]) => { emitted.push(a); return true; } };
  const svc = new AdminService(prisma, audit as any, events as any);
  return { svc, stub: { prisma, audit, events, calls } };
}

const pendingUser = () => ({
  id: 'u-pending',
  name: 'Pending',
  phone: '+255700000011',
  approvedAt: null,
  serviceExpiresAt: null,
  deletedAt: null,
  isPlatformAdmin: false,
});

const activeUser = () => ({
  id: 'u-active',
  name: 'Active',
  phone: '+255700000022',
  approvedAt: new Date(Date.now() - 10 * MONTH),
  serviceExpiresAt: new Date(Date.now() + 20 * MONTH),
  deletedAt: null,
  isPlatformAdmin: false,
});

describe('AdminService.listReviews', () => {
  test('queries only accounts needing attention (pending or expired)', async () => {
    const { svc, stub } = makeService(pendingUser(), { rows: [] });
    const res = await svc.listReviews({});
    expect(res.items).toEqual([]);
    const where = stub.calls.findManyArgs[0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.OR).toHaveLength(2);
    expect(where.OR[0]).toEqual({ approvedAt: null });
  });

  test('maps serviceStatus onto each row', async () => {
    const past = new Date(Date.now() - MONTH);
    const row = { ...pendingUser(), _count: { memberships: 2 } };
    const { svc } = makeService(pendingUser(), { rows: [{ ...row, approvedAt: past, serviceExpiresAt: new Date(Date.now() - 1000) }] });
    const res = await svc.listReviews({});
    expect(res.items[0].serviceStatus).toBe('EXPIRED');
  });
});

describe('AdminService.activateUser', () => {
  test('approves a pending account and grants one month from now', async () => {
    const { svc, stub } = makeService(pendingUser());
    const before = Date.now();
    const res = await svc.activateUser('admin-1', 'u-pending', META);
    expect(res.approvedAt).toBeInstanceOf(Date);
    const granted = (res.serviceExpiresAt as Date).getTime() - before;
    expect(granted).toBeGreaterThanOrEqual(MONTH - 5000);
    expect(granted).toBeLessThanOrEqual(MONTH + 5000);
    expect(stub.audit.entries).toHaveLength(1);
    expect(stub.audit.entries[0]).toMatchObject({ action: 'admin.user_activate', entityId: 'u-pending' });
  });

  test('extends from the existing expiry when already active (never shortens)', async () => {
    const user = activeUser();
    const { svc } = makeService(user);
    const res = await svc.activateUser('admin-1', user.id, META);
    expect((res.serviceExpiresAt as Date).getTime() - user.serviceExpiresAt.getTime()).toBe(MONTH);
  });

  test('throws NotFound for missing or deleted accounts', async () => {
    const { svc } = makeService(null);
    await expect(svc.activateUser('admin-1', 'nope', META)).rejects.toThrow('User not found.');
    const { svc: svc2 } = makeService({ ...pendingUser(), deletedAt: new Date() });
    await expect(svc2.activateUser('admin-1', 'u-pending', META)).rejects.toThrow('User not found.');
  });
});

describe('AdminService.renewUser', () => {
  test('renews an active account by one month without shortening', async () => {
    const user = activeUser();
    const { svc, stub } = makeService(user);
    const res = await svc.renewUser('admin-1', user.id, META);
    expect((res.serviceExpiresAt as Date).getTime() - user.serviceExpiresAt.getTime()).toBe(MONTH);
    expect(stub.audit.entries[0]).toMatchObject({ action: 'admin.user_renew' });
  });

  test('an expired account restarts from now', async () => {
    const user = { ...activeUser(), serviceExpiresAt: new Date(Date.now() - 5 * MONTH) };
    const { svc } = makeService(user);
    const before = Date.now();
    const res = await svc.renewUser('admin-1', user.id, META);
    const granted = (res.serviceExpiresAt as Date).getTime() - before;
    expect(granted).toBeGreaterThanOrEqual(MONTH - 5000);
  });

  test('an unapproved account is activated instead', async () => {
    const { svc, stub } = makeService(pendingUser());
    const res = await svc.renewUser('admin-1', 'u-pending', META);
    expect(res.approvedAt).toBeInstanceOf(Date);
    expect(stub.audit.entries[0].action).toBe('admin.user_activate');
  });
});

describe('AdminService.rejectUser', () => {
  test('soft-deletes a pending signup and audits the rejection', async () => {
    const { svc, stub } = makeService(pendingUser());
    const res = await svc.rejectUser('admin-1', 'u-pending', META);
    expect(res.deletedAt).toBeInstanceOf(Date);
    expect(stub.audit.entries[0]).toMatchObject({ action: 'admin.user_reject', entityId: 'u-pending' });
  });

  test('refuses to reject an approved account', async () => {
    const { svc } = makeService(activeUser());
    await expect(svc.rejectUser('admin-1', 'u-active', META)).rejects.toThrow(
      'Account is already approved — delete it instead of rejecting.',
    );
  });
});
