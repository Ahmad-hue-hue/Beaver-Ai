import { describe, expect, it } from 'bun:test';
import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it.each([
    ['+255774899262', '+255774899262'],
    ['255774899262', '+255774899262'],
    ['0774899262', '+255774899262'],
    ['+255 774 899 262', '+255774899262'],
    ['0774-899-262', '+255774899262'],
    ['(0774) 899 262', '+255774899262'],
    ['00255774899262', '+255774899262'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([['asha@duka.co.tz'], ['12345'], ['+254712345678'], [''], ['+25577489926']])(
    'rejects %s',
    (input) => {
      expect(() => normalizePhone(input)).toThrow(/Tanzanian phone number/);
    },
  );
});
