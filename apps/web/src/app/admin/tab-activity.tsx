'use client';

import { Typography } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { fetchPage, fmtTime, listPageRows, type ActivityRow, type Page } from './admin-types';
import { CardGrid, EmptyNote, ErrorNote, FieldRow, LoadMoreButton, Loader, RecordCard, SearchField, useDebouncedSearch } from './admin-ui';

/** System-wide audit feed — intentionally read-only (tamper-evident). */
export function ActivityTab() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const { value, setValue, query } = useDebouncedSearch();

  const list = useInfiniteQuery({
    queryKey: ['admin', 'activities', query],
    queryFn: ({ pageParam }) =>
      fetchPage<ActivityRow>('/admin/activities', token, 50, pageParam, query ? `&action=${encodeURIComponent(query)}` : ''),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<ActivityRow>) => last.nextCursor,
    enabled: !!token,
  });

  const rows = listPageRows(list.data);
  const hasMore = list.data?.pages.at(-1)?.hasMore ?? false;

  return (
    <>
      <Typography variant="h1" sx={{ mb: 0.5 }}>{t('admin.tab.activity')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{t('admin.activity.subtitle')}</Typography>
      <SearchField value={value} onChange={setValue} />
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
                  <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', overflowWrap: 'anywhere' }}>
                    {r.action}
                  </Typography>
                }
                body={
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"JetBrains Mono", monospace', overflowWrap: 'anywhere' }}>
                      {r.entityType}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}
                    </Typography>
                    <FieldRow label={t('admin.col.business')} value={r.business?.name ?? '—'} />
                    <FieldRow label={t('admin.col.who')} value={r.user?.name ?? '—'} />
                    <FieldRow label={t('admin.col.created')} value={fmtTime(r.createdAt)} />
                  </>
                }
              />
            ))}
          </CardGrid>
          <LoadMoreButton hasMore={hasMore} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
        </>
      )}
    </>
  );
}
