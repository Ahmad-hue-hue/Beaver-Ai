import type { Permission, PlanKey, Role } from '@beaver/shared';

/** Signed into the access JWT. Kept small; permissions are derived at issue time. */
export interface JwtPayload {
  sub: string; // userId
  bid: string | null; // active businessId (null before onboarding)
  role: Role | null;
  perms: Permission[];
  adm: boolean; // platform admin
  plan: PlanKey | null; // active business plan
  trip: boolean; // whether the 14-day trial is currently active for this business
}

/** Attached to every authenticated request (req.user). */
export interface AuthenticatedUser {
  userId: string;
  businessId: string | null;
  role: Role | null;
  permissions: Permission[];
  isPlatformAdmin: boolean;
  plan: PlanKey | null;
  isTrial: boolean;
}
