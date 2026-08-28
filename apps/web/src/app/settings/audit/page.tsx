'use client';

import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Activity, ChevronDown, Loader2 } from '@/components/ui/icon';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  user: { name: string } | null;
}
interface Page {
  items: AuditRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

const time = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export default function AuditPage() {
  return (
    <AppShell>
      <AuditContent />
    </AppShell>
  );
}

function AuditContent() {
  const { session } = useAuth();
  const token = session?.accessToken;

  const query = useInfiniteQuery<Page>({
    queryKey: ['audit'],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${String(pageParam)}` : '';
      return api.get<Page>(`/audit?limit=50${cursor}`, { accessToken: token });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!token,
  });

  if (query.error instanceof ApiError && query.error.status === 403) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <p className="text-lg font-medium text-slate-800">No access to the audit log</p>
        <p className="mt-1 text-slate-500">Only the shop owner can view the audit trail.</p>
      </div>
    );
  }

  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];
  const hasMore = query.data?.pages.at(-1)?.hasMore ?? false;

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Audit log</h1>
        <p className="mt-1 text-slate-500">A tamper-evident trail of sensitive business actions.</p>
      </header>

      <div className="mt-8">
        {query.isLoading ? (
          <p className="py-10 text-center text-slate-400">
            <Loader2 className="mx-auto size-5 animate-spin" />
          </p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <Activity className="size-6" />
            </span>
            <p className="mt-4 font-medium text-slate-700">No activity recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-slate-800">{r.action}</p>
                  <p className="text-xs text-slate-400">
                    {r.entityType}
                    {r.entityId ? ` · ${r.entityId}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-slate-500">{r.user?.name ?? 'System'}</p>
                  <p className="text-xs text-slate-400">{time(r.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="tap inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {query.isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ChevronDown className={cn('size-4')} />
            )}
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
