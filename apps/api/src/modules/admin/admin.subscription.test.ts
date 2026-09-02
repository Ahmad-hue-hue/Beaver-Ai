import { describe, expect, test } from 'bun:test';
import { AdminService } from './admin.service.js';

describe('AdminService.subscriptionStatus', () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  test('pending when never approved', () => {
    expect(AdminService.subscriptionStatus({ approvedAt: null, serviceExpiresAt: null })).toBe('PENDING');
  });

  test('active when approved with no expiry date', () => {
    expect(AdminService.subscriptionStatus({ approvedAt: past, serviceExpiresAt: null })).toBe('ACTIVE');
  });

  test('active when approved and expiry is in the future', () => {
    expect(AdminService.subscriptionStatus({ approvedAt: past, serviceExpiresAt: future })).toBe('ACTIVE');
  });

  test('expired when approved but past expiry', () => {
    expect(AdminService.subscriptionStatus({ approvedAt: past, serviceExpiresAt: past })).toBe('EXPIRED');
  });
});
