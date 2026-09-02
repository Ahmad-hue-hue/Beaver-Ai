'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Check, ChevronDown, LayoutDashboard, Loader2, LogOut, RefreshCw, Search, Shield, ShoppingBag, Users } from '@/components/ui/icon';
import { BrandMark } from '@/components/brand-mark';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'reviews' | 'businesses' | 'users' | 'activity';

type ServiceStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED';

interface SubscriptionInfo {
  status: ServiceStatus;
  serviceExpiresAt: string | null;
}

interface Overview {
  totalBusinesses: number;
  totalUsers: number;
  platformAdmins: number;
  pendingUsers: number;
  expiredUsers: number;
  activeUsers: number;
  salesToday: number;
  revenueToday: number;
  signupsToday: number;
  recentSignups: { id: string; name: string; email: string; isPlatformAdmin: boolean; createdAt: string }[];
}

interface ReviewRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isPlatformAdmin: boolean;
  approvedAt: string | null;
  serviceExpiresAt: string | null;
  createdAt: string;
  serviceStatus: ServiceStatus;
  memberCount: number;
}

interface BusinessRow {
  id: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  owner: { name: string; email: string; approvedAt: string | null; serviceExpiresAt: string | null } | null;
  ownerSubscription: SubscriptionInfo | null;
  memberCount: number;
  productCount: number;
  salesCount: number;
  revenue: number;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isPlatformAdmin: boolean;
  approvedAt: string | null;
  serviceExpiresAt: string | null;
  createdAt: string;
  serviceStatus: ServiceStatus;
  memberCount: number;
}

interface ActivityRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  business: { name: string } | null;
  user: { name: string; email: string } | null;
}

interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

export default function AdminPage() {
  const { session, loading, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <BrandMark size={44} className="animate-pulse" />
      </div>
    );
  }

  if (!session) {
    router.replace('/login');
    return null;
  }

  if (!session.user.isPlatformAdmin) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <Shield className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">{t('admin.noAccess')}</h1>
        <p className="mt-1 text-slate-500">{t('admin.noAccessBody')}</p>
      </div>
    );
  }

  const signOut = () => logout().then(() => router.replace('/login'));

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-hairline bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <span className="text-lg font-semibold tracking-tight text-slate-900">Beaver</span>
            <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-brand-700">
              ADMIN
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <p className="hidden text-sm text-slate-500 sm:block">{session.user.name}</p>
            <button
              onClick={signOut}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="size-4" />
              {t('admin.signOut')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('admin.title')}</h1>
          <p className="mt-1 text-slate-500">{t('admin.subtitle')}</p>
        </header>
        <AdminTabs />
      </main>
    </div>
  );
}

function SubscriptionBadge({ status, t }: { status: ServiceStatus; t: (key: string) => string }) {
  const cls =
    status === 'ACTIVE'
      ? 'border-brand-200 bg-brand-50 text-brand-700'
      : status === 'PENDING'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-red-200 bg-red-50 text-red-700';
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', cls)}>
      {t(`admin.badge.${status.toLowerCase()}`)}
    </span>
  );
}

function AdminTabs() {
  const { t } = useI18n();
  const [tab, setTab] = React.useState<Tab>('overview');

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'overview', label: t('admin.tab.overview'), icon: LayoutDashboard },
    { key: 'reviews', label: t('admin.tab.reviews'), icon: Check },
    { key: 'businesses', label: t('admin.tab.businesses'), icon: ShoppingBag },
    { key: 'users', label: t('admin.tab.users'), icon: Users },
    { key: 'activity', label: t('admin.tab.activity'), icon: Activity },
  ];

  return (
    <>
      <div className="-mx-5 flex gap-1 overflow-x-auto px-5 sm:-mx-8 sm:px-8" role="tablist">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'tap inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'reviews' && <ReviewsTab />}
        {tab === 'businesses' && <BusinessesTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'activity' && <ActivityTab />}
      </div>
    </>
  );
}

function OverviewTab() {
  const { t } = useI18n();
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api.get<Overview>('/admin/overview', { accessToken: session?.accessToken }),
    enabled: !!session?.accessToken,
  });

  if (query.isLoading) return <Loader />;
  if (query.isError)
    return <p className="py-10 text-center text-slate-400">{(query.error as Error).message}</p>;
  const o = query.data!;

  const stats: { label: string; value: string }[] = [
    { label: t('admin.stat.businesses'), value: String(o.totalBusinesses) },
    { label: t('admin.stat.users'), value: String(o.totalUsers) },
    { label: t('admin.stat.active'), value: String(o.activeUsers) },
    { label: t('admin.stat.pending'), value: String(o.pendingUsers) },
    { label: t('admin.stat.expired'), value: String(o.expiredUsers) },
    { label: t('admin.stat.admins'), value: String(o.platformAdmins) },
    { label: t('admin.stat.salesToday'), value: String(o.salesToday) },
    { label: t('admin.stat.revenueToday'), value: formatMoney(o.revenueToday) },
    { label: t('admin.stat.signupsToday'), value: String(o.signupsToday) },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="border-b border-hairline pb-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('admin.recentSignups')}</h2>
        {o.recentSignups.length === 0 ? (
          <p className="mt-4 text-slate-400">{t('admin.empty')}</p>
        ) : (
          <div className="mt-3 divide-y divide-hairline">
            {o.recentSignups.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {u.name}
                    {u.isPlatformAdmin && (
                      <span className="ml-2 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                        {t('admin.badge.admin')}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">{u.email}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-400">{fmtTime(u.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function ReviewsTab() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const { value, setValue, query } = useDebouncedSearch();

  const list = useInfiniteQuery<Page<ReviewRow>>({
    queryKey: ['admin', 'reviews', query],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${String(pageParam)}` : '';
      const search = query ? `&search=${encodeURIComponent(query)}` : '';
      return api.get<Page<ReviewRow>>(`/admin/reviews?limit=30${cursor}${search}`, { accessToken: token });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!token,
  });

  const mutate = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'renew' }) =>
      api.post(`/admin/reviews/${id}/${action}`, undefined, { accessToken: token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  const rows = listPageRows(list.data);
  const hasMore = list.data?.pages.at(-1)?.hasMore ?? false;

  return (
    <>
      <SearchBox value={value} onChange={setValue} placeholder={t('admin.search')} />
      {list.isLoading ? (
        <Loader />
      ) : (
        <>
          <div className="mt-5 divide-y divide-hairline">
            {rows.map((u) => (
              <div key={u.id} className="flex flex-col gap-3 border-b border-hairline py-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                    <span className="truncate">{u.name}</span>
                    <SubscriptionBadge status={u.serviceStatus} t={t} />
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {u.serviceStatus === 'EXPIRED'
                      ? t('admin.review.expiredOn', { date: fmtDate(u.serviceExpiresAt) })
                      : t('admin.review.signedUp', { date: fmtDate(u.createdAt) })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-nowrap sm:items-center">
                  <button
                    onClick={() => mutate.mutate({ id: u.id, action: 'activate' })}
                    disabled={mutate.isPending}
                    className="tap inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                  >
                    <Check className="size-4" />
                    {u.serviceStatus === 'EXPIRED' ? t('admin.review.activate') : t('admin.review.approve')}
                  </button>
                  <button
                    onClick={() => mutate.mutate({ id: u.id, action: 'renew' })}
                    disabled={mutate.isPending}
                    className="tap inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className="size-4" />
                    {t('admin.review.renew')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {rows.length === 0 && <p className="py-10 text-center text-slate-400">{t('admin.review.none')}</p>}
          <LoadMore hasMore={hasMore} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} t={t} />
        </>
      )}
    </>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full max-w-xs rounded-xl border border-hairline bg-surface pl-9 pr-3.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 sm:max-w-sm"
      />
    </div>
  );
}

function useDebouncedSearch(delay = 300) {
  const [value, setValue] = React.useState('');
  const [query, setQuery] = React.useState('');
  React.useEffect(() => {
    const id = window.setTimeout(() => setQuery(value.trim()), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return { value, setValue, query };
}

function BusinessesTab() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const { value, setValue, query } = useDebouncedSearch();

  const list = useInfiniteQuery<Page<BusinessRow>>({
    queryKey: ['admin', 'businesses', query],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${String(pageParam)}` : '';
      const search = query ? `&search=${encodeURIComponent(query)}` : '';
      return api.get<Page<BusinessRow>>(`/admin/businesses?limit=30${cursor}${search}`, { accessToken: token });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!token,
  });

  const rows = listPageRows(list.data);
  const hasMore = list.data?.pages.at(-1)?.hasMore ?? false;

  return (
    <>
      <SearchBox value={value} onChange={setValue} placeholder={t('admin.search')} />
      {list.isLoading ? (
        <Loader />
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="mt-5 space-y-3 md:hidden">
            {rows.map((b) => (
              <div key={b.id} className="rounded-xl border border-hairline p-4">
                <p className="font-medium text-slate-800">{b.name}</p>
                <p className="text-xs text-slate-400">
                  {b.type} · {b.country}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {b.owner?.name ?? '—'}
                  {b.owner?.email ? <span className="block truncate text-xs text-slate-400">{b.owner.email}</span> : null}
                </p>
                {b.ownerSubscription && (
                  <div className="mt-2">
                    <SubscriptionBadge status={b.ownerSubscription.status} t={t} />
                  </div>
                )}
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <dt className="text-slate-400">{t('admin.col.products')}</dt>
                    <dd className="tabular mt-0.5 font-medium text-slate-700">{b.productCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">{t('admin.col.sales')}</dt>
                    <dd className="tabular mt-0.5 font-medium text-slate-700">{b.salesCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">{t('admin.col.revenue')}</dt>
                    <dd className="tabular mt-0.5 font-medium text-slate-800">
                      {formatMoney(b.revenue, { currency: b.currency })}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4 font-medium">{t('admin.col.name')}</th>
                  <th className="py-2 pr-4 font-medium">{t('admin.col.owner')}</th>
                  <th className="py-2 pr-4 font-medium">{t('admin.col.subscription')}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t('admin.col.products')}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t('admin.col.sales')}</th>
                  <th className="py-2 text-right font-medium">{t('admin.col.revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 pr-4">
                      <p className="text-sm font-medium text-slate-800">{b.name}</p>
                      <p className="text-xs text-slate-400">
                        {b.type} · {b.country}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-sm text-slate-700">{b.owner?.name ?? '—'}</p>
                      <p className="text-xs text-slate-400">{b.owner?.email ?? ''}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {b.ownerSubscription ? (
                        <div className="flex flex-col items-start gap-1">
                          <SubscriptionBadge status={b.ownerSubscription.status} t={t} />
                          {b.ownerSubscription.serviceExpiresAt && (
                            <span className="text-xs text-slate-400">
                              {t('admin.col.renews', { date: fmtDate(b.ownerSubscription.serviceExpiresAt) })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-sm text-slate-600">{b.productCount}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-sm text-slate-600">{b.salesCount}</td>
                    <td className="py-3 text-right tabular-nums text-sm font-medium text-slate-800">
                      {formatMoney(b.revenue, { currency: b.currency })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <p className="py-10 text-center text-slate-400">{t('admin.empty')}</p>}
          <LoadMore
            hasMore={hasMore}
            loading={list.isFetchingNextPage}
            onLoad={() => list.fetchNextPage()}
            t={t}
          />
        </>
      )}
    </>
  );
}

function UsersTab() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const { value, setValue, query } = useDebouncedSearch();

  const list = useInfiniteQuery<Page<UserRow>>({
    queryKey: ['admin', 'users', query],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${String(pageParam)}` : '';
      const search = query ? `&search=${encodeURIComponent(query)}` : '';
      return api.get<Page<UserRow>>(`/admin/users?limit=30${cursor}${search}`, { accessToken: token });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!token,
  });

  const rows = listPageRows(list.data);
  const hasMore = list.data?.pages.at(-1)?.hasMore ?? false;

  return (
    <>
      <SearchBox value={value} onChange={setValue} placeholder={t('admin.search')} />
      {list.isLoading ? (
        <Loader />
      ) : (
        <>
          <div className="mt-5 divide-y divide-hairline">
            {rows.map((u) => (
              <div key={u.id} className="flex flex-col gap-2 border-b border-hairline py-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium text-slate-800">
                    <span className="truncate">{u.name}</span>
                    <SubscriptionBadge status={u.serviceStatus} t={t} />
                    {u.isPlatformAdmin && (
                      <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                        {t('admin.badge.admin')}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <p className="text-xs text-slate-400">
                    {u.memberCount} {t('admin.col.businesses')}
                  </p>
                  <p className="text-xs text-slate-400 sm:w-28 sm:text-right">{fmtTime(u.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          {rows.length === 0 && <p className="py-10 text-center text-slate-400">{t('admin.empty')}</p>}
          <LoadMore hasMore={hasMore} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} t={t} />
        </>
      )}
    </>
  );
}

function ActivityTab() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const { value, setValue, query } = useDebouncedSearch();

  const list = useInfiniteQuery<Page<ActivityRow>>({
    queryKey: ['admin', 'activities', query],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${String(pageParam)}` : '';
      const action = query ? `&action=${encodeURIComponent(query)}` : '';
      return api.get<Page<ActivityRow>>(`/admin/activities?limit=50${cursor}${action}`, { accessToken: token });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!token,
  });

  const rows = listPageRows(list.data);
  const hasMore = list.data?.pages.at(-1)?.hasMore ?? false;

  return (
    <>
      <SearchBox value={value} onChange={setValue} placeholder={t('admin.search')} />
      {list.isLoading ? (
        <Loader />
      ) : (
        <>
          <div className="mt-5 divide-y divide-hairline">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 border-b border-hairline py-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-slate-800">{r.action}</p>
                  <p className="truncate text-xs text-slate-400">
                    {r.entityType}
                    {r.entityId ? ` · ${r.entityId}` : ''}
                    {r.business ? ` · ${r.business.name}` : ''}
                  </p>
                </div>
                <div className="shrink-0 sm:text-right">
                  <p className="truncate text-sm text-slate-500">{r.user?.name ?? '—'}</p>
                  <p className="text-xs text-slate-400">{fmtTime(r.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          {rows.length === 0 && <p className="py-10 text-center text-slate-400">{t('admin.empty')}</p>}
          <LoadMore hasMore={hasMore} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} t={t} />
        </>
      )}
    </>
  );
}

function LoadMore({
  hasMore,
  loading,
  onLoad,
  t,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoad: () => void;
  t: (key: string) => string;
}) {
  if (!hasMore) return null;
  return (
    <div className="mt-6 flex justify-center">
      <button
        onClick={onLoad}
        disabled={loading}
        className="tap inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
        {t('admin.loadMore')}
      </button>
    </div>
  );
}

function Loader() {
  return (
    <p className="py-10 text-center text-slate-400">
      <Loader2 className="mx-auto size-5 animate-spin" />
    </p>
  );
}

function listPageRows<T>(data: { pages: { items: T[] }[] } | undefined): T[] {
  return data?.pages.flatMap((p) => p.items) ?? [];
}