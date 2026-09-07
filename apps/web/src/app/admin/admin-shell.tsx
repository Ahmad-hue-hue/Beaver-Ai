'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ThemeProvider,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Assessment as ActivityIcon,
  Business as BusinessIcon,
  Dashboard as OverviewIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Payments as PaymentsIcon,
  People as UsersIcon,
  RateReview as ReviewsIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/lib/auth-context';
import { LanguageToggle, useI18n } from '@/lib/i18n';
import { adminTheme, ADMIN_DRAWER_WIDTH } from './mui-theme';
import type { AdminTab } from './admin-types';

const NAV: { key: AdminTab; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'overview', labelKey: 'admin.tab.overview', icon: <OverviewIcon /> },
  { key: 'reviews', labelKey: 'admin.tab.reviews', icon: <ReviewsIcon /> },
  { key: 'businesses', labelKey: 'admin.tab.businesses', icon: <BusinessIcon /> },
  { key: 'users', labelKey: 'admin.tab.users', icon: <UsersIcon /> },
  { key: 'payments', labelKey: 'admin.tab.payments', icon: <PaymentsIcon /> },
  { key: 'activity', labelKey: 'admin.tab.activity', icon: <ActivityIcon /> },
];

/**
 * Platform-admin console shell: MUI dashboard layout (Berry/Toolpad-style).
 * Mobile-first — temporary slide-in drawer on phones, permanent rail on lg+.
 */
export function AdminShell({ children, tab, onTab }: {
  children: React.ReactNode;
  tab: AdminTab;
  onTab: (t: AdminTab) => void;
}) {
  return (
    <AppRouterCacheProvider options={{ key: 'beaver-admin' }}>
      <ThemeProvider theme={adminTheme}>
        <CssBaseline />
        <AdminShellInner tab={tab} onTab={onTab}>{children}</AdminShellInner>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}

function AdminShellInner({ children, tab, onTab }: {
  children: React.ReactNode;
  tab: AdminTab;
  onTab: (t: AdminTab) => void;
}) {
  const { session, loading, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = React.useState(false);

  if (loading) {
    return (
      <Box sx={{ display: 'grid', minHeight: '100dvh', placeItems: 'center' }}>
        <BrandMark size={44} className="animate-pulse" />
      </Box>
    );
  }

  if (!session) {
    router.replace('/admin/login');
    return null;
  }

  if (!session.user.isPlatformAdmin) {
    return (
      <Box sx={{ mx: 'auto', display: 'flex', minHeight: '100dvh', maxWidth: 380, flexDirection: 'column', justifyContent: 'center', px: 3, textAlign: 'center' }}>
        <ShieldIcon sx={{ mx: 'auto', fontSize: 48, color: 'text.disabled' }} />
        <Typography variant="h1" sx={{ mt: 2 }}>{t('admin.noAccess')}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>{t('admin.noAccessBody')}</Typography>
      </Box>
    );
  }

  const signOut = () => logout().then(() => router.replace('/admin/login'));

  const drawer = (
    <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 2 }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <BrandMark size={32} />
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>Beaver</Typography>
        </Link>
        <Box component="span" sx={{ border: '1px solid', borderColor: 'primary.100', bgcolor: 'primary.50', color: 'primary.700', borderRadius: 999, px: 1, fontFamily: 'monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', py: 0.25 }}>
          ADMIN
        </Box>
      </Box>
      <Divider />
      <List sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 2 }}>
        {NAV.map((item) => (
          <ListItemButton
            key={item.key}
            selected={tab === item.key}
            onClick={() => { onTab(item.key); setMobileOpen(false); }}
            sx={{
              borderRadius: 2.5,
              mb: 0.5,
              minHeight: 48,
              '&.Mui-selected': { bgcolor: 'primary.50', color: 'primary.700', '&:hover': { bgcolor: 'primary.100' }, '& .MuiListItemIcon-root': { color: 'primary.700' } },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={t(item.labelKey)} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 2, py: 1.5 }}>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
          {session.user.name}
        </Typography>
        <LanguageToggle />
      </Box>
      <Box sx={{ px: 1.5, pb: 2 }}>
        <ListItemButton onClick={signOut} sx={{ borderRadius: 2.5, minHeight: 48 }}>
          <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon /></ListItemIcon>
          <ListItemText primary={t('admin.signOut')} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      {/* Mobile top bar */}
      {!desktop && (
        <AppBar position="fixed" sx={{ display: { lg: 'none' } }}>
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label={t('app.openMenu')}>
              <MenuIcon />
            </IconButton>
            <BrandMark size={28} />
            <Typography variant="h6" component="span" sx={{ fontWeight: 700, flex: 1 }}>Beaver</Typography>
            <Box component="span" sx={{ border: '1px solid', borderColor: 'primary.100', bgcolor: 'primary.50', color: 'primary.700', borderRadius: 999, px: 1, fontFamily: 'monospace', fontSize: 10, fontWeight: 700, py: 0.25 }}>
              ADMIN
            </Box>
          </Toolbar>
        </AppBar>
      )}

      {/* Drawer: temporary on mobile, permanent on desktop */}
      {desktop ? (
        <Drawer variant="permanent" open sx={{ display: { xs: 'none', lg: 'block' }, '& .MuiDrawer-paper': { width: ADMIN_DRAWER_WIDTH } }}>
          {drawer}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { lg: 'none' }, '& .MuiDrawer-paper': { width: ADMIN_DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          ml: { lg: `${ADMIN_DRAWER_WIDTH}px` },
          mt: { xs: '56px', lg: 0 },
          px: { xs: 2, sm: 4, lg: 5 },
          pb: 8,
          pt: { xs: 3, lg: 4 },
          maxWidth: 1200,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
