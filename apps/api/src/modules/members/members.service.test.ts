import { describe, expect, it } from 'bun:test';
import { tempPassword } from './members.service.js';

describe('MembersService tempPassword', () => {
  it('returns a non-empty password', () => {
    expect(tempPassword().length).toBeGreaterThan(8);
  });

  it('produces unique values (enough entropy for one-time passwords)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const p = tempPassword();
      expect(seen.has(p)).toBe(false);
      seen.add(p);
    }
  });

  it('uses URL-safe characters only (safe for email/SMS and login)', () => {
    expect(new RegExp('^[A-Za-z0-9_-]+$').test(tempPassword())).toBe(true);
  });
});
