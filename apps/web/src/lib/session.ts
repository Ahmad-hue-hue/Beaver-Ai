/** Shapes returned by the auth endpoints (mirrors the API's SessionResult). */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
}

export interface Membership {
  businessId: string;
  businessName: string;
  role: string;
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
  businessId: string | null;
  role: string | null;
  memberships: Membership[];
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface OnboardInput {
  name: string;
  type: string;
  country?: string;
  currency?: string;
  phone?: string;
}
