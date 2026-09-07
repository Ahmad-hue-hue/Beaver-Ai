'use client';

import * as React from 'react';
import { Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Switch, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, Delete as VoidIcon, Edit as EditIcon, Print as PrintIcon, Receipt as ReceiptIcon } from '@mui/icons-material';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { fetchPage, fmtDate, fmtTime, listPageRows, money, type Page, type PaymentRow, type UserRow } from './admin-types';
import { dataGridSx } from './mui-theme';
import { ConfirmDialog, EmptyNote, ErrorNote, LoadMoreButton, Loader, RowMenu, useDebouncedSearch } from './admin-ui';

const METHODS = ['CASH', 'MOBILE_MONEY', 'BANK', 'CARD'];
const DEFAULT_AMOUNT = 50000;

export function PaymentsTab() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [showVoided, setShowVoided] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [editing, setEditing] = React.useState<PaymentRow | null>(null);
  const [voiding, setVoiding] = React.useState<PaymentRow | null>(null);
  const [receipt, setReceipt] = React.useState<PaymentRow | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const list = useInfiniteQuery({
    queryKey: ['admin', 'payments', showVoided],
    queryFn: ({ pageParam }) =>
      fetchPage<PaymentRow>('/admin/payments', token, 30, pageParam, showVoided ? '&includeVoided=true' : ''),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<PaymentRow>) => last.nextCursor,
    enabled: !!token,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const recordMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/admin/payments', body, { accessToken: token }),
    onSuccess: () => { setRecording(false); setFormError(null); refresh(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/admin/payments/${id}`, body, { accessToken: token }),
    onSuccess: () => { setEditing(null); setFormError(null); refresh(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const voidMut = useMutation({
    mutationFn: (id: string) => api.del(`/admin/payments/${id}`, { accessToken: token }),
    onSuccess: () => { setVoiding(null); setFormError(null); refresh(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const rows = listPageRows(list.data);
  const hasMore = list.data?.pages.at(-1)?.hasMore ?? false;

  const columns: GridColDef<PaymentRow>[] = [
    {
      field: 'payer', headerName: t('admin.payments.payer'), flex: 1, minWidth: phone ? 140 : 190,
      renderCell: (p) => (
        <Box sx={{ lineHeight: 1.3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{p.row.user.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{p.row.user.phone}</Typography>
        </Box>
      ),
    },
    {
      field: 'amount', headerName: t('admin.payments.amount'), width: 140, type: 'number',
      renderCell: (p) => (
        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {money(p.row.amount)}
        </Typography>
      ),
    },
    {
      field: 'method', headerName: t('admin.payments.method'), width: 130,
      renderCell: (p) => <Chip size="small" variant="outlined" label={t(`admin.payments.method.${p.row.method.toLowerCase()}`)} />,
    },
    {
      field: 'period', headerName: t('admin.payments.period'), width: 200,
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary">
          {fmtDate(p.row.periodStart)} → {fmtDate(p.row.periodEnd)}
        </Typography>
      ),
    },
    {
      field: 'recordedBy', headerName: t('admin.payments.recordedBy'), width: 140,
      renderCell: (p) => <Typography variant="body2" noWrap>{p.row.recordedBy.name}</Typography>,
    },
    {
      field: 'status', headerName: t('admin.col.subscription'), width: 120, sortable: false,
      renderCell: (p) => p.row.voidedAt
        ? <Chip size="small" color="default" label={t('admin.payments.voided')} />
        : <Chip size="small" color="success" label={t('admin.payments.valid')} />,
    },
    {
      field: 'actions', headerName: '', width: 64, sortable: false, filterable: false, resizable: false,
      renderCell: (p) => (
        <RowMenu
          label={t('admin.rowMenu')}
          items={[
            { key: 'receipt', label: t('admin.payments.receipt'), icon: <ReceiptIcon fontSize="small" />, onSelect: () => setReceipt(p.row) },
            ...(!p.row.voidedAt ? [
              { key: 'edit', label: t('admin.crud.edit'), icon: <EditIcon fontSize="small" />, onSelect: () => { setFormError(null); setEditing(p.row); } },
              { key: 'void', label: t('admin.payments.void'), icon: <VoidIcon fontSize="small" />, danger: true, onSelect: () => { setFormError(null); setVoiding(p.row); } },
            ] : []),
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
        <Box>
          <Typography variant="h1">{t('admin.tab.payments')}</Typography>
          <Typography color="text.secondary">{t('admin.payments.subtitle')}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setFormError(null); setRecording(true); }} sx={{ flexShrink: 0 }}>
          {phone ? t('admin.payments.recordShort') : t('admin.payments.record')}
        </Button>
      </Box>

      <FormControlLabel
        control={<Switch checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />}
        label={t('admin.payments.showVoided')}
        sx={{ mb: 1 }}
      />

      {formError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError(null)}>{formError}</Alert>}

      {list.isLoading ? (
        <Loader />
      ) : list.isError ? (
        <ErrorNote message={(list.error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyNote text={t('admin.payments.empty')} />
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
            columnVisibilityModel={phone ? { period: false, recordedBy: false } : {}}
            sx={dataGridSx}
          />
          <LoadMoreButton hasMore={hasMore} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
        </>
      )}

      <RecordDialog
        key={recording ? 'record-open' : 'record-closed'}
        open={recording}
        busy={recordMut.isPending}
        errorText={formError}
        token={token}
        onClose={() => { setRecording(false); setFormError(null); }}
        onSave={(body) => recordMut.mutate(body)}
      />

      <EditPaymentDialog
        key={editing ? `payment-${editing.id}` : 'payment-closed'}
        row={editing}
        busy={updateMut.isPending}
        errorText={formError}
        onClose={() => { setEditing(null); setFormError(null); }}
        onSave={(body) => editing && updateMut.mutate({ id: editing.id, body })}
      />

      <ConfirmDialog
        open={voiding !== null}
        title={t('admin.payments.voidTitle')}
        body={t('admin.payments.voidBody', { name: voiding?.user.name ?? '', amount: voiding ? money(voiding.amount) : '' })}
        confirmLabel={t('admin.payments.void')}
        busy={voidMut.isPending}
        errorText={formError}
        onCancel={() => { setVoiding(null); setFormError(null); }}
        onConfirm={() => voiding && voidMut.mutate(voiding.id)}
      />

      <ReceiptDialog row={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}

/** Async payer search against the admin users endpoint. */
function usePayerSearch(token: string | undefined) {
  const { value, setValue, query } = useDebouncedSearch();
  const search = useQuery({
    queryKey: ['admin', 'users', 'payer-search', query],
    queryFn: () =>
      api.get<{ items: UserRow[] }>(
        `/admin/users?limit=10${query ? `&search=${encodeURIComponent(query)}` : ''}`,
        { accessToken: token },
      ),
    enabled: !!token,
  });
  return { value, setValue, options: search.data?.items ?? [], loading: search.isFetching };
}

function RecordDialog({ open, busy, errorText, token, onClose, onSave }: {
  open: boolean;
  busy: boolean;
  errorText?: string | null;
  token: string | undefined;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const payer = usePayerSearch(token);
  // Remounted on every open via parent `key` — initializers are the fresh defaults.
  const [userId, setUserId] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState(String(DEFAULT_AMOUNT));
  const [method, setMethod] = React.useState('CASH');
  const [months, setMonths] = React.useState(1);
  const [paidAt, setPaidAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = React.useState('');
  const [note, setNote] = React.useState('');

  const valid = userId !== null && Number(amount) >= 0.01 && months >= 1 && months <= 12 && paidAt !== '';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('admin.payments.record')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {errorText && <Alert severity="error">{errorText}</Alert>}
        <Autocomplete
          options={payer.options}
          getOptionLabel={(u) => `${u.name} — ${u.phone}`}
          loading={payer.loading}
          onInputChange={(_, v) => payer.setValue(v)}
          onChange={(_, u) => setUserId(u?.id ?? null)}
          renderInput={(params) => <TextField {...params} label={t('admin.payments.payer')} sx={{ mt: 1 }} />}
          renderOption={(props, u) => (
            <li {...props} key={u.id}>
              <Box sx={{ lineHeight: 1.3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{u.name}</Typography>
                <Typography variant="caption" color="text.secondary">{u.phone}</Typography>
              </Box>
            </li>
          )}
        />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField label={t('admin.payments.amount')} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} />
          <TextField label={t('admin.payments.method')} value={method} onChange={(e) => setMethod(e.target.value)} select>
            {METHODS.map((m) => <MenuItem key={m} value={m}>{t(`admin.payments.method.${m.toLowerCase()}`)}</MenuItem>)}
          </TextField>
          <TextField label={t('admin.payments.months')} type="number" value={months} onChange={(e) => setMonths(Number(e.target.value))} slotProps={{ htmlInput: { min: 1, max: 12, step: 1 } }} />
          <TextField label={t('admin.payments.paidAt')} type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
        <TextField label={t('admin.payments.reference')} value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="M-Pesa TxID / receipt no." />
        <TextField label={t('admin.payments.note')} value={note} onChange={(e) => setNote(e.target.value)} multiline rows={2} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">{t('admin.crud.cancel')}</Button>
        <Button
          variant="contained"
          disabled={busy || !valid}
          onClick={() => onSave({
            userId,
            amount: Number(amount),
            method,
            months,
            paidAt: new Date(paidAt).toISOString(),
            ...(referenceNo.trim() ? { referenceNo: referenceNo.trim() } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          })}
        >
          {t('admin.payments.record')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditPaymentDialog({ row, busy, errorText, onClose, onSave }: {
  row: PaymentRow | null;
  busy: boolean;
  errorText?: string | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  // Remounted per row via parent `key` — lazy initializer is the current values.
  const [form, setForm] = React.useState(() => ({
    amount: row ? String(row.amount) : '',
    method: row?.method ?? 'CASH',
    referenceNo: row?.referenceNo ?? '',
    paidAt: row ? new Date(row.paidAt).toISOString().slice(0, 10) : '',
    note: row?.note ?? '',
  }));

  return (
    <Dialog open={row !== null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('admin.payments.editTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Alert severity="info" sx={{ mt: 1 }}>{t('admin.payments.immutablePeriod')}</Alert>
        {errorText && <Alert severity="error">{errorText}</Alert>}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField label={t('admin.payments.amount')} type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} />
          <TextField label={t('admin.payments.method')} value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} select>
            {METHODS.map((m) => <MenuItem key={m} value={m}>{t(`admin.payments.method.${m.toLowerCase()}`)}</MenuItem>)}
          </TextField>
        </Box>
        <TextField
          label={t('admin.payments.paidAt')} type="date" value={form.paidAt}
          onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField label={t('admin.payments.reference')} value={form.referenceNo} onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))} />
        <TextField label={t('admin.payments.note')} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} multiline rows={2} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">{t('admin.crud.cancel')}</Button>
        <Button
          variant="contained"
          disabled={busy || !(Number(form.amount) >= 0.01)}
          onClick={() => onSave({
            amount: Number(form.amount),
            method: form.method,
            referenceNo: form.referenceNo.trim(),
            paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : undefined,
            note: form.note.trim(),
          })}
        >
          {t('admin.crud.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Printable receipt for one payment record. */
function ReceiptDialog({ row, onClose }: { row: PaymentRow | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog open={row !== null} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('admin.payments.receipt')}</DialogTitle>
      <DialogContent>
        {row && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, fontFamily: 'monospace' }}>
            <ReceiptLine k={t('admin.payments.payer')} v={`${row.user.name} (${row.user.phone})`} mono={false} />
            <ReceiptLine k={t('admin.payments.amount')} v={money(row.amount)} />
            <ReceiptLine k={t('admin.payments.method')} v={row.method} />
            <ReceiptLine k={t('admin.payments.period')} v={`${fmtDate(row.periodStart)} → ${fmtDate(row.periodEnd)}`} />
            <ReceiptLine k={t('admin.payments.paidAt')} v={fmtTime(row.paidAt)} />
            {row.referenceNo && <ReceiptLine k={t('admin.payments.reference')} v={row.referenceNo} />}
            <ReceiptLine k={t('admin.payments.recordedBy')} v={`${row.recordedBy.name}`} mono={false} />
            <ReceiptLine k={t('admin.payments.status')} v={row.voidedAt ? t('admin.payments.voided') : t('admin.payments.valid')} mono={false} />
            {row.note && <ReceiptLine k={t('admin.payments.note')} v={row.note} mono={false} />}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">{t('admin.crud.cancel')}</Button>
        <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
          {t('admin.payments.print')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ReceiptLine({ k, v, mono = true }: { k: string; v: string; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, borderBottom: '1px dashed #eef1f4', pb: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: mono ? 'monospace' : undefined }}>{k}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: mono ? '"JetBrains Mono", monospace' : undefined, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</Typography>
    </Box>
  );
}
