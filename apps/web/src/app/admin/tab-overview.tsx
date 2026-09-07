'use client';

import { Box, Card, CardContent, Chip, List, ListItem, ListItemText, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { fmtTime, money, type Overview } from './admin-types';
import { ErrorNote, Loader } from './admin-ui';

export function OverviewTab() {
  const { t } = useI18n();
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api.get<Overview>('/admin/overview', { accessToken: session?.accessToken }),
    enabled: !!session?.accessToken,
  });

  if (query.isLoading) return <Loader />;
  if (query.isError) return <ErrorNote message={(query.error as Error).message} />;
  const o = query.data!;

  const stats: { label: string; value: string; money?: boolean }[] = [
    { label: t('admin.stat.businesses'), value: String(o.totalBusinesses) },
    { label: t('admin.stat.users'), value: String(o.totalUsers) },
    { label: t('admin.stat.active'), value: String(o.activeUsers) },
    { label: t('admin.stat.pending'), value: String(o.pendingUsers) },
    { label: t('admin.stat.expired'), value: String(o.expiredUsers) },
    { label: t('admin.stat.admins'), value: String(o.platformAdmins) },
    { label: t('admin.stat.salesToday'), value: String(o.salesToday) },
    { label: t('admin.stat.revenueToday'), value: money(o.revenueToday), money: true },
    { label: t('admin.stat.signupsToday'), value: String(o.signupsToday) },
  ];

  return (
    <>
      <Typography variant="h1" sx={{ mb: 0.5 }}>{t('admin.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t('admin.subtitle')}</Typography>

      {/* Mobile-first stat cards: 2-up on phones → 3-up on sm → 4-up on lg */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' } }}>
        {stats.map((s) => (
          <Card key={s.label} variant="outlined">
            <CardContent sx={{ px: 2, py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h2" color="text.secondary">{s.label}</Typography>
              <Typography
                variant="h4"
                component="p"
                sx={{ mt: 0.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: s.money ? '1.1rem' : '1.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {s.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Typography variant="h2" color="text.secondary" sx={{ mt: 5, mb: 1 }}>{t('admin.recentSignups')}</Typography>
      {o.recentSignups.length === 0 ? (
        <Typography color="text.secondary">{t('admin.empty')}</Typography>
      ) : (
        <Card variant="outlined">
          <List disablePadding>
            {o.recentSignups.map((u) => (
              <ListItem key={u.id} divider secondaryAction={
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {fmtTime(u.createdAt)}
                </Typography>
              }>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{u.name}</Typography>
                      {u.isPlatformAdmin && <Chip size="small" color="primary" label={t('admin.badge.admin')} />}
                    </Box>
                  }
                  secondary={u.phone}
                  slotProps={{ secondary: { noWrap: true } }}
                />
              </ListItem>
            ))}
          </List>
        </Card>
      )}
    </>
  );
}
