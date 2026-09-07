'use client';

import { api } from '@/lib/api-client';
import { formatMoney } from '@/lib/money';

export type AdminTab = 'overview' | 'reviews' | 'businesses' | 'users' | 'payments' | 'activity';

export type ServiceStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED';

export interface SubscriptionInfo {
  status: ServiceStatus;
  serviceExpiresAt: string | null;
}

export interface Overview {
  totalBusinesses: number;
  totalUsers: number;
  platformAdmins: number;
  pendingUsers: number;
  expiredUsers: number;
  activeUsers: number;
  salesToday: number;
  revenueToday: number;
  signupsToday: number;
  recentSignups: { id: string; name: string; phone: string; isPlatformAdmin: boolean; createdAt: string }[];
}

export interface ReviewRow {
  id: string;
  name: string;
  phone: string;
  isPlatformAdmin: boolean;
  approvedAt: string | null;
  serviceExpiresAt: string | null;
  createdAt: string;
  serviceStatus: ServiceStatus;
  memberCount: number;
}

export interface BusinessRow {
  id: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
  owner: { name: string; phone: string; approvedAt: string | null; serviceExpiresAt: string | null } | null;
  ownerSubscription: SubscriptionInfo | null;
  memberCount: number;
  productCount: number;
  salesCount: number;
  revenue: number;
}

export interface UserRow {
  id: string;
  name: string;
  phone: string;
  isPlatformAdmin: boolean;
  approvedAt: string | null;
  serviceExpiresAt: string | null;
  createdAt: string;
  serviceStatus: ServiceStatus;
  memberCount: number;
}

export interface PaymentRow {
  id: string;
  userId: string;
  businessId: string | null;
  amount: number | string;
  method: string;
  referenceNo: string | null;
  paidAt: string;
  months: number;
  periodStart: string;
  periodEnd: string;
  note: string | null;
  recordedById: string;
  voidedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string };
  business: { id: string; name: string } | null;
  recordedBy: { id: string; name: string; phone: string };
}

export interface ActivityRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  business: { name: string } | null;
  user: { name: string; phone: string } | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

/** ISO date (yyyy-mm-dd) for native date inputs; '' when null. */
export const toInputDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export function listPageRows<T>(data: { pages: { items: T[] }[] } | undefined): T[] {
  return data?.pages.flatMap((p) => p.items) ?? [];
}

export function money(v: number | string, currency?: string): string {
  const n = typeof v === 'string' ? Number(v) : v;
  return formatMoney(n, currency ? { currency } : undefined);
}

export async function fetchPage<T>(path: string, token: string | undefined, limit: number, pageParam: unknown, extra = '') {
  const cursor = pageParam ? `&cursor=${String(pageParam)}` : '';
  return api.get<Page<T>>(`${path}?limit=${limit}${cursor}${extra}`, { accessToken: token });
}
