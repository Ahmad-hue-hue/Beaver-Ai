'use client';

import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { MoreVert as MoreVertIcon } from '@mui/icons-material';
import { useI18n } from '@/lib/i18n';
import type { ServiceStatus } from './admin-types';

export function useDebouncedSearch(delay = 300) {
  const [value, setValue] = React.useState('');
  const [query, setQuery] = React.useState('');
  React.useEffect(() => {
    const id = window.setTimeout(() => setQuery(value.trim()), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return { value, setValue, query };
}

export function StatusChip({ status }: { status: ServiceStatus }) {
  const { t } = useI18n();
  const color = status === 'ACTIVE' ? 'success' : status === 'PENDING' ? 'warning' : 'error';
  return <Chip size="small" color={color} label={t(`admin.badge.${status.toLowerCase()}`)} sx={{ fontWeight: 600 }} />;
}

export function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('admin.search')}
      sx={{ maxWidth: { xs: '100%', sm: 360 }, mb: 2 }}
    />
  );
}

export function Loader() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
      <CircularProgress />
    </Box>
  );
}

export function EmptyNote({ text }: { text: string }) {
  return (
    <Typography color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
      {text}
    </Typography>
  );
}

export function LoadMoreButton({ hasMore, loading, onLoad }: { hasMore: boolean; loading: boolean; onLoad: () => void }) {
  const { t } = useI18n();
  if (!hasMore) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
      <Button variant="outlined" onClick={onLoad} disabled={loading}>
        {loading ? <CircularProgress size={18} /> : t('admin.loadMore')}
      </Button>
    </Box>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <Typography color="error" sx={{ py: 5, textAlign: 'center' }}>
      {message}
    </Typography>
  );
}

/** Responsive module grid: 1-across on phones → 2 on sm/md → 3 on desktop. */
export function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
      }}
    >
      {children}
    </Box>
  );
}

/** One modular record card: `top` header row, `body` label/value rows, optional footer slot. */
export function RecordCard({ top, body, footer, muted = false }: {
  top: React.ReactNode;
  body?: React.ReactNode;
  footer?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        ...(muted ? { opacity: 0.62, backgroundColor: 'background.default' } : {}),
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, px: 2, py: 2, flex: 1, minWidth: 0, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0 }}>{top}</Box>
        {body && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.25, minWidth: 0 }}>{body}</Box>
        )}
      </CardContent>
      {footer && (
        <>
          <Divider />
          <Box sx={{ px: 2, py: 1.5 }}>{footer}</Box>
        </>
      )}
    </Card>
  );
}

/** Hairline label/value row used inside RecordCard bodies (tabular money in mono). */
export function FieldRow({ label, value, mono = false }: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, pt: 0.25 }}>{label}</Typography>
      <Box sx={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            overflowWrap: 'anywhere',
            fontFamily: mono ? '"JetBrains Mono", monospace' : undefined,
            fontVariantNumeric: mono ? 'tabular-nums' : undefined,
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

/** Small metric shown in a card footer (products / sales / revenue). */
export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{value}</Typography>
    </Box>
  );
}

/** Destructive-action confirmation (delete user/business, void payment, reject). */export function ConfirmDialog({ open, title, body, confirmLabel, busy, errorText, onCancel, onConfirm }: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  /** Server error to show inside the dialog (the tab behind is covered by the modal). */
  errorText?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{body}</DialogContentText>
        {errorText && <Alert severity="error" sx={{ mt: 2 }}>{errorText}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onCancel} disabled={busy} color="inherit">{t('admin.crud.cancel')}</Button>
        <Button onClick={onConfirm} disabled={busy} color="error" variant="contained">
          {busy ? <CircularProgress size={18} color="inherit" /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export interface RowMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

/**
 * Per-row "⋮" submenu for grid rows (edit / delete / receipt / void).
 * One compact, always-visible touch target — replaces side-by-side icon
 * buttons that get pushed off-screen on phones.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const open = anchor !== null;
  return (
    <>
      <IconButton
        size="small"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ minWidth: 44, minHeight: 44 }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={open} onClose={() => setAnchor(null)}>
        {items.map((item) => (
          <MenuItem
            key={item.key}
            onClick={() => { setAnchor(null); item.onSelect(); }}
            sx={item.danger ? { color: 'error.main' } : undefined}
          >
            {item.icon && <ListItemIcon sx={item.danger ? { color: 'error.main' } : undefined}>{item.icon}</ListItemIcon>}
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
