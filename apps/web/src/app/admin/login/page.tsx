'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  TextField,
  ThemeProvider,
  Typography,
} from '@mui/material';
import { Shield as ShieldIcon } from '@mui/icons-material';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import { LanguageToggle, useI18n } from '@/lib/i18n';
import { adminTheme } from '../mui-theme';

/**
 * Independent platform-admin login. Separate screen from the shop login:
 * only accounts flagged isPlatformAdmin may pass — everyone else gets an
 * access-denied error and stays here.
 */
export default function AdminLoginPage() {
  return (
    <AppRouterCacheProvider options={{ key: 'beaver-admin' }}>
      <ThemeProvider theme={adminTheme}>
        <CssBaseline />
        <AdminLoginInner />
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}

function AdminLoginInner() {
  const { session, loading, login } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!loading && session?.user.isPlatformAdmin) router.replace('/admin');
  }, [loading, session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const s = await login(phone, password);
      if (!s.user.isPlatformAdmin) {
        setError(t('adminLogin.notAdmin'));
        return;
      }
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('adminLogin.failed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'grid', minHeight: '100dvh', placeItems: 'center' }}>
        <BrandMark size={44} className="animate-pulse" />
      </Box>
    );
  }

  // An admin with a live session belongs in the console, not on this screen.
  if (session?.user.isPlatformAdmin) return null;

  return (
    <Box sx={{ mx: 'auto', display: 'flex', minHeight: '100dvh', maxWidth: 380, flexDirection: 'column', justifyContent: 'center', px: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
        <BrandMark size={48} />
        <Box>
          <Typography variant="h1">{t('adminLogin.title')}</Typography>
          <Typography color="text.secondary">{t('adminLogin.subtitle')}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <ShieldIcon fontSize="small" color="primary" />
        <Typography variant="caption" color="primary" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
          {t('adminLogin.badge')}
        </Typography>
      </Box>

      <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <TextField
          label={t('adminLogin.phone')}
          type="tel"
          slotProps={{ htmlInput: { inputMode: 'tel' } }}
          placeholder="+255 700 000 000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label={t('adminLogin.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" size="large" disabled={busy} fullWidth>
          {busy ? t('adminLogin.signingIn') : t('adminLogin.signIn')}
        </Button>
      </Box>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <LanguageToggle />
      </Box>
    </Box>
  );
}
