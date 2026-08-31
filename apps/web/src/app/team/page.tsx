'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Shield, UserPlus, X } from '@/components/ui/icon';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Member {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'INVENTORY_STAFF';
  status: 'ACTIVE' | 'SUSPENDED';
}

const ROLE_LABEL: Record<Member['role'], string> = {
  OWNER: 'team.role.owner',
  MANAGER: 'team.role.manager',
  CASHIER: 'team.role.cashier',
  INVENTORY_STAFF: 'team.role.inventory',
};
const ROLES: Member['role'][] = ['OWNER', 'MANAGER', 'CASHIER', 'INVENTORY_STAFF'];
const MANAGE_ROLES = new Set(['OWNER', 'MANAGER']);

export default function TeamPage() {
  return (
    <AppShell>
      <TeamContent />
    </AppShell>
  );
}

function TeamContent() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const myRole = session?.role as Member['role'] | null;
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = React.useState(false);

  const members = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get<Member[]>('/members', { accessToken: token }),
    enabled: !!token,
  });

  const canManage = !!myRole && MANAGE_ROLES.has(myRole);

  if (members.error instanceof ApiError && members.error.status === 403) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <p className="text-lg font-medium text-slate-800">{t('team.noAccess')}</p>
        <p className="mt-1 text-slate-500">
          {t('team.noAccessBody')}
        </p>
      </div>
    );
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['members'] });

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('team.title')}</h1>
          <p className="mt-1 text-slate-500">{t('team.subtitle')}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="tap inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
          >
            <UserPlus className="size-4" />
            {t('team.invite')}
          </button>
        )}
      </header>

      {showInvite && (
        <InviteForm
          token={token}
          onDone={() => {
            setShowInvite(false);
            invalidate();
          }}
        />
      )}

      <div className="mt-8">
        {members.isLoading ? (
          <p className="py-10 text-center text-slate-400">
            <Loader2 className="mx-auto size-5 animate-spin" />
          </p>
        ) : (
          <div className="divide-y divide-hairline">
            {members.data?.map((m) => (
              <MemberRow
                key={m.membershipId}
                member={m}
                canManage={canManage}
                isMe={m.userId === session?.user.id}
                onChanged={invalidate}
                token={token}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InviteForm({
  token,
  onDone,
}: {
  token?: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<Member['role']>('CASHIER');
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () =>
      api.post<{ temporaryPassword?: string | null }>('/members', { name, email, role }, { accessToken: token }),
    onSuccess: (res) => {
      setTempPassword(res.temporaryPassword ?? null);
      qc.invalidateQueries({ queryKey: ['members'] });
    },
  });

  return (
    <div className="mt-8 rounded-2xl border border-hairline p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">
          {tempPassword ? t('team.accountCreated') : t('team.inviteTitle')}
        </h2>
        <button
          onClick={() => {
            setTempPassword(null);
            onDone();
          }}
          className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
        >
          <X className="size-5" />
        </button>
      </div>

      {tempPassword != null ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            {t('team.oneTimePw')}
          </p>
          <p className="mt-2 rounded-lg bg-surface px-3 py-2 font-mono text-sm text-brand-700">{tempPassword}</p>
          <button
            onClick={onDone}
            className="tap mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            {t('common.done')}
          </button>
        </div>
      ) : (
        <form
          className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('team.field.name')}
            required
            className="tap h-10 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-brand-400"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('team.field.email')}
            type="email"
            required
            className="tap h-10 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-brand-400"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Member['role'])}
            className="tap h-10 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-brand-400"
          >
            {ROLES.filter((r) => r !== 'OWNER').map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABEL[r])}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={invite.isPending}
            className="tap inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {invite.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {t('common.send')}
          </button>
        </form>
      )}
      {invite.isError && (
        <p className="mt-3 text-sm font-medium text-red-600">
          {invite.error instanceof ApiError ? invite.error.message : t('team.inviteFail')}
        </p>
      )}
    </div>
  );
}

function MemberRow({
  member: m,
  canManage,
  isMe,
  onChanged,
  token,
}: {
  member: Member;
  canManage: boolean;
  isMe: boolean;
  onChanged: () => void;
  token?: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['members'] });
  const setRole = useMutation({
    mutationFn: (role: Member['role']) =>
      api.patch(`/members/${m.membershipId}/role`, { role }, { accessToken: token }),
    onSuccess: () => {
      invalidate();
      onChanged();
    },
  });
  const setStatus = useMutation({
    mutationFn: (active: boolean) =>
      api.post(`/members/${m.membershipId}/${active ? 'reactivate' : 'suspend'}`, undefined, { accessToken: token }),
    onSuccess: () => {
      invalidate();
      onChanged();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/members/${m.membershipId}`, { accessToken: token }),
    onSuccess: () => {
      invalidate();
      onChanged();
    },
  });

  const suspended = m.status === 'SUSPENDED';
  const isOwner = m.role === 'OWNER';

  return (
    <div className="flex items-center gap-4 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">
        {m.name
          .split(' ')
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn('truncate font-medium text-slate-900', suspended && 'text-slate-400 line-through')}>
            {m.name}
            {isMe && <span className="ml-2 text-xs font-normal text-slate-400">{t('team.you')}</span>}
          </p>
          {isOwner && <Shield className="size-4 text-brand-600" />}
        </div>
        <p className="truncate text-sm text-slate-500">{m.email}</p>
      </div>

      {canManage && !isOwner ? (
        <select
          value={m.role}
          onChange={(e) => setRole.mutate(e.target.value as Member['role'])}
          disabled={setRole.isPending}
          className="tap h-9 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-brand-400 disabled:opacity-50"
        >
          {ROLES.filter((r) => r !== 'OWNER').map((r) => (
            <option key={r} value={r}>
              {t(ROLE_LABEL[r])}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-sm font-medium text-slate-600">{t(ROLE_LABEL[m.role])}</span>
      )}

      {canManage && !isOwner && !isMe && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStatus.mutate(suspended)}
            disabled={setStatus.isPending}
            className="tap rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            {suspended ? t('team.reactivate') : t('team.suspend')}
          </button>
          <button
            onClick={() => {
              if (confirm(t('team.removeConfirm', { name: m.name }))) remove.mutate();
            }}
            disabled={remove.isPending}
            className="tap rounded-lg px-2 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {t('team.remove')}
          </button>
        </div>
      )}
    </div>
  );
}
