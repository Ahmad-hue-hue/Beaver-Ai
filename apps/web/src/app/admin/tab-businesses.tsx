'use client';

import * as React from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { fetchPage, fmtDate, listPageRows, money, type BusinessRow, type Page } from './admin-types';
import { dataGridSx } from './mui-theme';
import { ConfirmDialog, EmptyNote, ErrorNote, LoadMoreButton, Loader, RowMenu, SearchField, StatusChip, useDebouncedSearch } from './admin-ui';

const BUSINESS_TYPES = ['RETAIL', 'WHOLESALE', 'PHARMACY', 'RESTAURANT', 'GROCERY', 'ELECTRONICS', 'HARDWARE', 'OTHER'];

export function BusinessesTab() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const { value, setValue, query } = useDebouncedSearch();
  const [editing, setEditing] = React.useState<BusinessRow | null>(null);
  const [deleting, setDeleting] = React.useState<BusinessRow | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const list = useInfiniteQuery({
    queryKey: ['admin', 'businesses', query],
    queryFn: ({ pageParam }) =>
      fetchPage<BusinessRow>('/admin/businesses', token, 30, pageParam, query ? `&search=${encodeURIComponent(query)}` : ''),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<BusinessRow>) => last.nextCursor,
    enabled: !!token,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/admin/businesses/${id}`, body, { accessToken: token }),
    onSuccess: () => { setEditing(null); setFormError(null); refresh(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/admin/businesses/${id}`, { accessToken: token }),
    onSuccess: () => { setDeleting(null); setFormError(null); refresh(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const rows = listPageRows(list.data);
  const hasMore = list.data?.pages.at(-1)?.hasMore ?? false;

  const columns: GridColDef<BusinessRow>[] = [
    {
      field: 'name', headerName: t('admin.col.name'), flex: 1, minWidth: phone ? 140 : 180,
      renderCell: (p) => (
        <Box sx={{ lineHeight: 1.3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{p.row.name}</Typography>
          <Typography variant="caption" color="text.secondary">{p.row.type} · {p.row.country}</Typography>
        </Box>
      ),
    },
    {
      field: 'owner', headerName: t('admin.col.owner'), flex: 1, minWidth: phone ? 130 : 170,
      renderCell: (p) => (
        <Box sx={{ lineHeight: 1.3 }}>
          <Typography variant="body2" noWrap>{p.row.owner?.name ?? '—'}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{p.row.owner?.phone ?? ''}</Typography>
        </Box>
      ),
    },
    {
      field: 'subscription', headerName: t('admin.col.subscription'), width: 170, sortable: false,
      renderCell: (p) => p.row.ownerSubscription ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
          <StatusChip status={p.row.ownerSubscription.status} />
          {p.row.ownerSubscription.serviceExpiresAt && (
            <Typography variant="caption" color="text.secondary">
              {t('admin.col.renews', { date: fmtDate(p.row.ownerSubscription.serviceExpiresAt) })}
            </Typography>
          )}
        </Box>
      ) : <Typography color="text.secondary">—</Typography>,
    },
    { field: 'productCount', headerName: t('admin.col.products'), width: 100, type: 'number' },
    { field: 'salesCount', headerName: t('admin.col.sales'), width: 90, type: 'number' },
    {
      field: 'revenue', headerName: t('admin.col.revenue'), width: 140, type: 'number',
      renderCell: (p) => (
        <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {money(p.row.revenue, p.row.currency)}
        </Typography>
      ),
    },
    {
      field: 'actions', headerName: '', width: 64, sortable: false, filterable: false, resizable: false,
      renderCell: (p) => (
        <RowMenu
          label={t('admin.rowMenu')}
          items={[
            { key: 'edit', label: t('admin.crud.edit'), icon: <EditIcon fontSize="small" />, onSelect: () => { setFormError(null); setEditing(p.row); } },
            { key: 'delete', label: t('admin.crud.delete'), icon: <DeleteIcon fontSize="small" />, danger: true, onSelect: () => { setFormError(null); setDeleting(p.row); } },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <Typography variant="h1" sx={{ mb: 0.5 }}>{t('admin.tab.businesses')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{t('admin.businesses.subtitle')}</Typography>
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
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={(r) => r.id}
            autoHeight
            hideFooter
            disableRowSelectionOnClick
            rowHeight={64}
            columnVisibilityModel={phone ? { productCount: false, salesCount: false } : {}}
            sx={dataGridSx}
          />
          <LoadMoreButton hasMore={hasMore} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
        </>
      )}

      <BusinessDialog
        key={editing ? `biz-${editing.id}` : 'biz-closed'}
        row={editing}
        busy={updateMut.isPending}
        errorText={formError}
        onClose={() => { setEditing(null); setFormError(null); }}
        onSave={(body) => editing && updateMut.mutate({ id: editing.id, body })}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t('admin.businesses.deleteTitle')}
        body={t('admin.businesses.deleteBody', { name: deleting?.name ?? '' })}
        confirmLabel={t('admin.crud.delete')}
        busy={deleteMut.isPending}
        errorText={formError}
        onCancel={() => { setDeleting(null); setFormError(null); }}
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
      />
    </>
  );
}

function BusinessDialog({ row, busy, errorText, onClose, onSave }: {
  row: BusinessRow | null;
  busy: boolean;
  errorText?: string | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  // Remounted per row via parent `key` — lazy initializer is the current values.
  const [form, setForm] = React.useState(() => ({
    name: row?.name ?? '', type: row?.type ?? 'RETAIL', country: row?.country ?? '', currency: row?.currency ?? '',
    phone: row?.phone ?? '', address: row?.address ?? '',
  }));

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={row !== null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('admin.businesses.editTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {errorText && <Alert severity="error">{errorText}</Alert>}
        <TextField label={t('admin.col.name')} value={form.name} onChange={set('name')} sx={{ mt: 1 }} />
        <TextField label={t('admin.businesses.type')} value={form.type} onChange={set('type')} select>
          {BUSINESS_TYPES.map((bt) => <MenuItem key={bt} value={bt}>{bt}</MenuItem>)}
        </TextField>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField label={t('admin.businesses.country')} value={form.country} onChange={set('country')} />
          <TextField label={t('admin.businesses.currency')} value={form.currency} onChange={set('currency')} />
          <TextField label={t('admin.col.phone')} value={form.phone} onChange={set('phone')} />
        </Box>
        <TextField label={t('admin.businesses.address')} value={form.address} onChange={set('address')} multiline rows={2} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">{t('admin.crud.cancel')}</Button>
        <Button
          onClick={() => onSave({
            name: form.name.trim(),
            type: form.type,
            country: form.country.trim(),
            currency: form.currency.trim(),
            phone: form.phone.trim(),
            ...(form.address.trim() ? { address: form.address.trim() } : {}),
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
