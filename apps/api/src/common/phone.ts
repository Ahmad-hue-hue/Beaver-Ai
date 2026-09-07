import { BadRequestException } from '@nestjs/common';

/**
 * Tanzanian phone normalization — the single identity canonicalizer.
 *
 * Accepts `07…`, `255…`, `+255…` (plus spaces, dashes, brackets) and returns
 * E.164 `+255XXXXXXXXX`. Throws BadRequestException otherwise, so every
 * entry point (register, login, invite, admin edit) agrees on one identity.
 */
export function normalizePhone(raw: string): string {
  if (typeof raw !== 'string') {
    throw new BadRequestException('Enter a valid phone number, e.g. +255 774 899 262.');
  }
  let digits = raw.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `255${digits.slice(1)}`;
  if (!/^255\d{9}$/.test(digits)) {
    throw new BadRequestException('Enter a valid Tanzanian phone number, e.g. +255 774 899 262.');
  }
  return `+${digits}`;
}
