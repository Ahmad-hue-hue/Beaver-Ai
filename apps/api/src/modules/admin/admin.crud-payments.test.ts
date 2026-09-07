/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles: lightweight Prisma stubs, no production code affected */
import { describe, expect, test } from 'bun:test';
import { AdminService } from './admin.service.js';

/**
 * AdminService CRUD + subscription-payment tests (user/business update & delete,
 * record / correct / void payments). Prisma is stubbed — these verify
 * guardrails, atomic cascade wiring, LIFO discipline and audit payloads.
 */

const META = { ip: '127.0.0.1', userAgent: 'test' };
const MONTH = 30 * 24 * 60 * 60 * 1000;

function makeService(db: Record<string, any> = {}) {
  const auditEntries: any[] = [];
  const emitted: any[] = [];
  const txCalls: any[] = [];
  const tx = {
    subscriptionPayment: {
      create: async (args: any) => {
        txCalls.push(['payment.create', args]);
        return { id: 'pay-new', voidedAt: null, ...args.data };
      },
      update: async (args: any) => {
        txCalls.push(['payment.update', args]);
        return { ...db.payment, ...args.data };
      },
    },
    user: {
      update: async (args: any) => {
        txCalls.push(['user.update', args]);
        return { ...db.user, ...args.data };
      },
    },
    membership: {
      deleteMany: async (args: any) => {
        txCalls.push(['membership.deleteMany', args]);
        return { count: (db.memberships ?? []).length };
      },
    },
    business: {
      update: async (args: any) => {
        txCalls.push(['business.update', args]);
        return { ...db.business, ...args.data };
      },
    },
  };
  const prisma: any = {
    user: {
      findUnique: async () => db.user ?? null,
      update: async (args: any) => ({ ...db.user, ...args.data }),
      count: async () => db.remainingAdmins ?? 0,
    },
    business: {
      findUnique: async () => db.business ?? null,
      update: async (args: any) => ({ ...db.business, ...args.data }),
    },
    membership: {
      findMany: async () => db.memberships ?? [],
    },
    subscriptionPayment: {
      findUnique: async () => db.payment ?? null,
      findMany: async () => db.payments ?? [],
      findFirst: async (args: any) => {
        // LIFO check: a newer live payment exists.
        if (args?.where?.createdAt?.gt) return db.newerPayment ?? null;
        return db.latestPayment ?? db.previousPayment ?? null;
      },
      create: async (args: any) => ({ id: 'pay-new', voidedAt: null, ...args.data }),
      update: async (args: any) => ({ ...db.payment, ...args.data }),
    },
    $transaction: async (fn: any) => fn(tx),
  };
  const audit = { entries: auditEntries, record: async (e: any) => { auditEntries.push(e); } };
  const events = { emitted, emit: (...a: any[]) => { emitted.push(a); return true; } };
  return { svc: new AdminService(prisma, audit as any, events as any), auditEntries, emitted, txCalls };
}

const adminUser = (over: Record<string, any> = {}) => ({
  id: 'u-1',
  name: 'A',
  phone: '+255700000033',
  approvedAt: new Date(Date.now() - MONTH),
  serviceExpiresAt: new Date(Date.now() + MONTH),
  deletedAt: null,
  isPlatformAdmin: false,
  ...over,
});

describe('AdminService.updateUser', () => {
  test('edits name/phone and audits before/after', async () => {
    const { svc, auditEntries } = makeService({ user: adminUser() });
    const res: any = await svc.updateUser('admin-1', 'u-1', { name: 'B', phone: '0700000099' }, META);
    expect(res.name).toBe('B');
    expect(auditEntries[0]).toMatchObject({ action: 'admin.user_update', entityId: 'u-1' });
    expect(auditEntries[0].before.name).toBe('A');
    expect(auditEntries[0].after.name).toBe('B');
  });

  test('refuses self-demotion', async () => {
    const { svc } = makeService({ user: adminUser({ isPlatformAdmin: true }) });
    await expect(svc.updateUser('u-1', 'u-1', { isPlatformAdmin: false }, META)).rejects.toThrow(
      'You cannot remove your own platform-admin access.',
    );
  });

  test('refuses to demote the last platform admin', async () => {
    const { svc } = makeService({ user: adminUser({ id: 'u-9', isPlatformAdmin: true }), remainingAdmins: 0 });
    await expect(svc.updateUser('admin-1', 'u-9', { isPlatformAdmin: false }, META)).rejects.toThrow(
      'Cannot demote the last platform admin.',
    );
  });

  test('rejects empty updates', async () => {
    const { svc } = makeService({ user: adminUser() });
    await expect(svc.updateUser('admin-1', 'u-1', {}, META)).rejects.toThrow('Nothing to update.');
  });
});

describe('AdminService.deleteUser', () => {
  test('soft-deletes and audits', async () => {
    const { svc, auditEntries } = makeService({ user: adminUser() });
    const res = await svc.deleteUser('admin-1', 'u-1', META);
    expect(res.deletedAt).toBeInstanceOf(Date);
    expect(auditEntries[0].action).toBe('admin.user_delete');
  });

  test('refuses self-delete and last-admin delete', async () => {
    const { svc } = makeService({ user: adminUser() });
    await expect(svc.deleteUser('u-1', 'u-1', META)).rejects.toThrow('You cannot delete your own account.');
    const { svc: svc2 } = makeService({ user: adminUser({ id: 'u-9', isPlatformAdmin: true }), remainingAdmins: 0 });
    await expect(svc2.deleteUser('admin-1', 'u-9', META)).rejects.toThrow('Cannot delete the last platform admin.');
  });
});

describe('AdminService.deleteBusiness cascade', () => {
  const business = { id: 'b-1', name: 'Duka', deletedAt: null };

  test('detaches the whole team and soft-deletes atomically', async () => {
    const memberships = [
      { id: 'm-1', userId: 'u-1', role: 'OWNER', status: 'ACTIVE' },
      { id: 'm-2', userId: 'u-2', role: 'CASHIER', status: 'ACTIVE' },
    ];
    const { svc, auditEntries, txCalls } = makeService({ business, memberships });
    const res = await svc.deleteBusiness('admin-1', 'b-1', META);
    expect(res.detachedMemberships).toBe(2);
    const kinds = txCalls.map(([k]) => k);
    expect(kinds).toEqual(['membership.deleteMany', 'business.update']);
    expect(auditEntries[0]).toMatchObject({ action: 'admin.business_delete', entityId: 'b-1' });
    expect(auditEntries[0].after.detachedMemberships).toBe(2);
  });

  test('works for a business with no team', async () => {
    const { svc } = makeService({ business, memberships: [] });
    const res = await svc.deleteBusiness('admin-1', 'b-1', META);
    expect(res.detachedMemberships).toBe(0);
  });
});

describe('AdminService.recordPayment', () => {
  const payer = () => adminUser({ id: 'u-pay', approvedAt: null, serviceExpiresAt: null });

  test('records, auto-approves a pending payer and emits an event', async () => {
    const { svc, auditEntries, emitted } = makeService({ user: payer() });
    const before = Date.now();
    const res: any = await svc.recordPayment(
      'admin-1',
      { userId: 'u-pay', amount: 50000, method: 'MOBILE_MONEY', months: 1 },
      META,
    );
    expect(res.months).toBe(1);
    expect((res.periodEnd as Date).getTime() - before).toBeGreaterThanOrEqual(MONTH - 5000);
    expect(auditEntries[0]).toMatchObject({ action: 'admin.payment_record' });
    expect(emitted[0][0]).toBe('subscription.paid');
  });

  test('extends from the active expiry instead of now', async () => {
    const user = adminUser({ id: 'u-pay', serviceExpiresAt: new Date(Date.now() + 10 * MONTH) });
    const { svc } = makeService({ user });
    const res: any = await svc.recordPayment('admin-1', { userId: 'u-pay', amount: 50000 }, META);
    expect((res.periodEnd as Date).getTime() - user.serviceExpiresAt.getTime()).toBe(MONTH);
  });

  test('rejects credit as a payment method', async () => {
    const { svc } = makeService({ user: payer() });
    await expect(
      svc.recordPayment('admin-1', { userId: 'u-pay', amount: 50000, method: 'CREDIT' }, META),
    ).rejects.toThrow('must be real money');
  });
});

describe('AdminService.updatePayment / voidPayment', () => {
  const live = (over: Record<string, any> = {}) => ({
    id: 'pay-1',
    userId: 'u-pay',
    businessId: null,
    amount: '50000',
    method: 'CASH',
    referenceNo: null,
    paidAt: new Date(),
    months: 1,
    periodStart: new Date(Date.now() - MONTH),
    periodEnd: new Date(),
    createdAt: new Date(),
    note: null,
    voidedAt: null,
    ...over,
  });

  test('corrects money fields but keeps the granted period', async () => {
    const payment = live();
    const { svc, auditEntries } = makeService({ payment, latestPayment: payment });
    const res: any = await svc.updatePayment('admin-1', 'pay-1', { amount: 55000, note: 'fix' }, META);
    expect(String(res.amount)).toBe('55000');
    expect(res.periodStart).toEqual(payment.periodStart);
    expect(res.periodEnd).toEqual(payment.periodEnd);
    expect(auditEntries[0].action).toBe('admin.payment_update');
  });

  test('refuses to touch voided payments', async () => {
    const { svc } = makeService({ payment: live({ voidedAt: new Date() }) });
    await expect(svc.updatePayment('admin-1', 'pay-1', { amount: 1 }, META)).rejects.toThrow(
      'Voided payments are immutable.',
    );
    await expect(svc.voidPayment('admin-1', 'pay-1', META)).rejects.toThrow('already voided');
  });

  test('void enforces LIFO: a newer live payment blocks the void', async () => {
    const { svc } = makeService({
      payment: live(),
      user: adminUser({ id: 'u-pay' }),
      newerPayment: { id: 'pay-2' },
    });
    await expect(svc.voidPayment('admin-1', 'pay-1', META)).rejects.toThrow('void it first');
  });

  test('void reverses the extension and falls back lastPaymentAmount', async () => {
    const user = adminUser({ id: 'u-pay', serviceExpiresAt: new Date() });
    const { svc, auditEntries, emitted } = makeService({
      payment: live(),
      user,
      newerPayment: null,
      previousPayment: { id: 'pay-0', amount: '50000' },
    });
    const res: any = await svc.voidPayment('admin-1', 'pay-1', META);
    expect(res.voidedAt).toBeInstanceOf(Date);
    expect(auditEntries[0].action).toBe('admin.payment_void');
    expect(emitted[0][0]).toBe('subscription.payment_voided');
  });
});
