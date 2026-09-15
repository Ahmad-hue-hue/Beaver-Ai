'use client';

import * as React from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Key as KeyIcon } from '@mui/icons-material';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { fetchPage, fmtDate, listPageRows, toInputDate, type Page, type UserRow } from './admin-types';
import { CardGrid, ConfirmDialog, EmptyNote, ErrorNote, FieldRow, LoadMoreButton, Loader, RecordCard, RowMenu, SearchField, StatusChip, useDebouncedSearch } from './admin-ui';

export function UsersTab() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const { value, setValue, query } = useDebouncedSearch();
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [deleting, setDeleting] = React.useState<UserRow | null>(null);
  const [resetting, setResetting] = React.useState<UserRow | null>(null);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const list = useInfiniteQuery({
    queryKey: ['admin', 'users', query],
    queryFn: ({ pageParam }) =>
      fetchPage<UserRow>('/admin/users', token, 30, pageParam, query ? `&search=${encodeURIComponent(query)}` : ''),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<UserRow>) => last.nextCursor,
    enabled: !!token,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/admin/users/${id}`, body, { accessToken: token }),
    onSuccess: () => { setEditing(null); setFormError(null); refresh(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/admin/users/${id}`, { accessToken: token }),
    onSuccess: () => { setDeleting(null); setFormError(null); refresh(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const resetMut = useMutation({
    mutationFn: (id: string) =>
      api.post<{ id: string; temporaryPassword: string }>(`/admin/users/${id}/reset-password`, undefined, { accessToken: token }),
    onSuccess: (res) => { setResetting(null); setFormError(null); setTempPassword(res.temporaryPassword); },
    onError: (e: Error) => setFormError(e.message),
  });

  const rows = listPageRows(list.data);
  const hasMore = list.data?.pages.at(-1)?.hasMore ?? false;

  return (
    <>
      <Typography variant="h1" sx={{ mb: 0.5 }}>{t('admin.tab.users')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{t('admin.users.subtitle')}</Typography>
      <SearchField value={value} onChange={setValue} />
      {formError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError(null)}>{formError}</Alert>}
      {list.isLoading ? (
        <Loader />
      ) : list.isError ? (
        <ErrorNote message={(list.error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyNote text={t('admin.empty')} />
      ) : (
        <>
          <CardGrid>
            {rows.map((r) => (
              <RecordCard
                key={r.id}
                top={
                  <>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{r.name}</Typography>
                        <StatusChip status={r.serviceStatus} />
                        {r.isPlatformAdmin && <Chip size="small" color="primary" label={t('admin.badge.admin')} />}
                      </Box>
                      <Typography variant="body2" color="text.secondary" noWrap>{r.phone}</Typography>
                    </Box>
                    <RowMenu
                      label={t('admin.rowMenu')}
                      items={[
                        { key: 'edit', label: t('admin.crud.edit'), icon: <EditIcon fontSize="small" />, onSelect: () => { setFormError(null); setEditing(r); } },
                        { key: 'reset', label: t('admin.users.resetPassword'), icon: <KeyIcon fontSize="small" />, onSelect: () => { setFormError(null); setResetting(r); } },
                        { key: 'delete', label: t('admin.crud.delete'), icon: <DeleteIcon fontSize="small" />, danger: true, onSelect: () => { setFormError(null); setDeleting(r); } },
                      ]}
                    />
                  </>
                }
                body={
                  <>
                    <FieldRow label={t('admin.col.businesses')} value={String(r.memberCount)} />
                    <FieldRow label={t('admin.col.subscription')} value={fmtDate(r.serviceExpiresAt)} />
                    <FieldRow label={t('admin.col.created')} value={fmtDate(r.createdAt)} />
                  </>
                }
              />
            ))}
          </CardGrid>
          <LoadMoreButton hasMore={hasMore} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
        </>
      )}

      <UserDialog
        key={editing ? `user-${editing.id}` : 'user-closed'}
        row={editing}
        busy={updateMut.isPending}
        errorText={formError}
        onClose={() => { setEditing(null); setFormError(null); }}
        onSave={(body) => editing && updateMut.mutate({ id: editing.id, body })}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t('admin.users.deleteTitle')}
        body={t('admin.users.deleteBody', { name: deleting?.name ?? '' })}
        confirmLabel={t('admin.crud.delete')}
        busy={deleteMut.isPending}
        errorText={formError}
        onCancel={() => { setDeleting(null); setFormError(null); }}
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
      />

      <ConfirmDialog
        open={resetting !== null}
        title={t('admin.users.resetTitle')}
        body={t('admin.users.resetBody', { name: resetting?.name ?? '', phone: resetting?.phone ?? '' })}
        confirmLabel={t('admin.users.resetConfirm')}
        busy={resetMut.isPending}
        errorText={formError}
        onCancel={() => { setResetting(null); setFormError(null); }}
        onConfirm={() => resetting && resetMut.mutate(resetting.id)}
      />

      <Dialog open={tempPassword !== null} onClose={() => setTempPassword(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('admin.users.tempTitle')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>{t('admin.users.tempHint')}</Alert>
          <Typography variant="body2" color="text.secondary">{t('admin.users.tempLabel')}</Typography>
          <Typography variant="h6" component="p" sx={{ fontFamily: 'monospace', mt: 0.5 }}>{tempPassword}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setTempPassword(null)} variant="contained">{t('admin.crud.done')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function UserDialog({ row, busy, errorText, onClose, onSave }: {
  row: UserRow | null;
  busy: boolean;
  errorText?: string | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  // Remounted per row via parent `key` — lazy initializer is the current values.
  const [form, setForm] = React.useState(() => ({
    name: row?.name ?? '',
    phone: row?.phone ?? '',
    admin: row?.isPlatformAdmin ?? false,
    approvedAt: toInputDate(row?.approvedAt ?? null),
    expiresAt: toInputDate(row?.serviceExpiresAt ?? null),
  }));

  return (
    <Dialog open={row !== null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('admin.users.editTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {errorText && <Alert severity="error">{errorText}</Alert>}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField label={t('admin.col.name')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label={t('admin.col.phone')} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <TextField
            label={t('admin.users.approvedAt')}
            type="date"
            value={form.approvedAt}
            onChange={(e) => setForm((f) => ({ ...f, approvedAt: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label={t('admin.users.expiresAt')}
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
        <FormControlLabel
          control={<Switch checked={form.admin} onChange={(e) => setForm((f) => ({ ...f, admin: e.target.checked }))} />}
          label={t('admin.users.platformAdmin')}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">{t('admin.crud.cancel')}</Button>
        <Button
          onClick={() => onSave({
            name: form.name.trim(),
            phone: form.phone.trim(),
            isPlatformAdmin: form.admin,
            ...(form.approvedAt ? { approvedAt: new Date(form.approvedAt).toISOString() } : {}),
            ...(form.expiresAt ? { serviceExpiresAt: new Date(form.expiresAt).toISOString() } : {}),
          })}
          disabled={busy || !form.name.trim()}
          variant="contained"
        >
          {t('admin.crud.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
