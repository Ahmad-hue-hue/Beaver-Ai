'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Loader2 } from '@/components/ui/icon';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  kind: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
  link?: string;
  readAt: string | null;
  createdAt: string;
}

const SEVERITY_DOT: Record<Notification['severity'], string> = {
  info: 'bg-slate-300',
  warn: 'bg-amber-400',
  critical: 'bg-red-500',
};

const relative = (iso: string) => {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
};

export default function NotificationsPage() {
  return (
    <AppShell>
      <NotificationsContent />
    </AppShell>
  );
}

function NotificationsContent() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get<Notification[]>('/notifications?limit=50', { accessToken: token }),
    enabled: !!token,
  });

  // Regenerate today's signals once on load (low-stock, debts, daily summary) — idempotent by day.
  useQuery({
    queryKey: ['notifications', 'generate'],
    queryFn: () => api.post('/notifications/generate', undefined, { accessToken: token }),
    enabled: !!token,
  });

  const read = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`, undefined, { accessToken: token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all', undefined, { accessToken: token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = list.data ?? [];
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notifications</h1>
          <p className="mt-1 text-slate-500">
            {unread > 0 ? `${unread} unread` : 'You’re all caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending}
            className="tap inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Check className="size-4" />
            Mark all read
          </button>
        )}
      </header>

      <div className="mt-8">
        {list.isLoading ? (
          <p className="py-10 text-center text-slate-400">
            <Loader2 className="mx-auto size-5 animate-spin" />
          </p>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <Bell className="size-6" />
            </span>
            <p className="mt-4 font-medium text-slate-700">Nothing to report</p>
            <p className="mt-1 text-sm text-slate-500">
              Low-stock, debt and daily-summary alerts will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 py-4',
                  !n.readAt && 'pr-2',
                )}
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', SEVERITY_DOT[n.severity])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={cn('font-medium text-slate-900', !n.readAt && 'font-semibold')}>
                      {n.title}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400">{relative(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
                  {n.link && (
                    <a
                      href={n.link}
                      className="mt-1 inline-flex text-sm font-medium text-brand-700 hover:underline"
                    >
                      View
                    </a>
                  )}
                </div>
                {!n.readAt && (
                  <button
                    onClick={() => read.mutate(n.id)}
                    className="tap rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Mark read"
                  >
                    <Check className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
