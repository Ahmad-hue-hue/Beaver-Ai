'use client';

import * as React from 'react';
import { Box, Button, Card, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { fetchPage, fmtDate, listPageRows, type Page, type ReviewRow } from './admin-types';
import { ConfirmDialog, EmptyNote, ErrorNote, LoadMoreButton, Loader, SearchField, StatusChip, useDebouncedSearch } from './admin-ui';

export function ReviewsTab() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const { value, setValue, query } = useDebouncedSearch();
  const [rejectId, setRejectId] = React.useState<string | null>(null);

  const list = useInfiniteQuery({
    queryKey: ['admin', 'reviews', query],
    queryFn: ({ pageParam }) =>
      fetchPage<ReviewRow>('/admin/reviews', token, 30, pageParam, query ? `&search=${encodeURIComponent(query)}` : ''),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<ReviewRow>) => last.nextCursor,
    enabled: !!token,
  });

  const mutate = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'renew' | 'reject' }) =>
      api.post(`/admin/reviews/${id}/${action}`, undefined, { accessToken: token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      setRejectId(null);
    },
  });

  const rows = listPageRows(list.data);
  const hasMore = list.data?.pages.at(-1)?.hasMore ?? false;

  return (
    <>
      <Typography variant="h1" sx={{ mb: 0.5 }}>{t('admin.tab.reviews')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{t('admin.review.subtitle')}</Typography>
      <SearchField value={value} onChange={setValue} />
      {list.isLoading ? (
        <Loader />
      ) : list.isError ? (
        <ErrorNote message={(list.error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyNote text={t('admin.review.none')} />
      ) : (
        <>
          <Card variant="outlined">
            <List disablePadding>
              {rows.map((u) => (
                <ListItem key={u.id} divider sx={{ flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, py: 2 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{u.name}</Typography>
                        <StatusChip status={u.serviceStatus} />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" sx={{ display: 'block' }} noWrap>{u.phone}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {u.serviceStatus === 'EXPIRED'
                            ? t('admin.review.expiredOn', { date: fmtDate(u.serviceExpiresAt) })
                            : t('admin.review.signedUp', { date: fmtDate(u.createdAt) })}
                        </Typography>
                      </>
                    }
                  />
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={mutate.isPending}
                      onClick={() => mutate.mutate({ id: u.id, action: 'activate' })}
                    >
                      {u.serviceStatus === 'EXPIRED' ? t('admin.review.activate') : t('admin.review.approve')}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={mutate.isPending}
                      onClick={() => mutate.mutate({ id: u.id, action: 'renew' })}
                    >
                      {t('admin.review.renew')}
                    </Button>
                    {u.serviceStatus === 'PENDING' && (
                      <Button
                        variant="text"
                        size="small"
                        color="error"
                        disabled={mutate.isPending}
                        onClick={() => setRejectId(u.id)}
                      >
                        {t('admin.review.reject')}
                      </Button>
                    )}
                  </Stack>
                </ListItem>
              ))}
            </List>
          </Card>
          <LoadMoreButton hasMore={hasMore} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
        </>
      )}

      <ConfirmDialog
        open={rejectId !== null}
        title={t('admin.review.rejectTitle')}
        body={t('admin.review.rejectBody')}
        confirmLabel={t('admin.review.reject')}
        busy={mutate.isPending}
        errorText={mutate.error ? (mutate.error as Error).message : null}
        onCancel={() => { setRejectId(null); mutate.reset(); }}
        onConfirm={() => rejectId && mutate.mutate({ id: rejectId, action: 'reject' })}
      />
    </>
  );
}
