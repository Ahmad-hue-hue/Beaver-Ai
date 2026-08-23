import type { Permission, Role } from '@beaver/shared';

/** Signed into the access JWT. Kept small; permissions are derived at issue time. */
export interface JwtPayload {
  sub: string; // userId
  bid: string | null; // active businessId (null before onboarding)
  role: Role | null;
  perms: Permission[];
  adm: boolean; // platform admin
}

/** Attached to every authenticated request (req.user). */
export interface AuthenticatedUser {
  userId: string;
  businessId: string | null;
  role: Role | null;
  permissions: Permission[];
  isPlatformAdmin: boolean;
}
