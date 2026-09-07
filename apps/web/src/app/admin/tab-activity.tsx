'use client';

import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { fetchPage, fmtTime, listPageRows, type ActivityRow, type Page } from './admin-types';
import { dataGridSx } from './mui-theme';
import { EmptyNote, ErrorNote, LoadMoreButton, Loader, SearchField, useDebouncedSearch } from './admin-ui';

/** System-wide audit feed — intentionally read-only (tamper-evident). */
export function ActivityTab() {
  const { t } = useI18n();
  const { session } = useAuth();
  const token = session?.accessToken;
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
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

  const columns: GridColDef<ActivityRow>[] = [
    {
      field: 'action', headerName: t('admin.col.action'), flex: 1, minWidth: 200,
      renderCell: (p) => (
        <Box sx={{ lineHeight: 1.3 }}>
          <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace' }} noWrap>{p.row.action}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {p.row.entityType}{p.row.entityId ? ` · ${p.row.entityId.slice(0, 8)}` : ''}{p.row.business ? ` · ${p.row.business.name}` : ''}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'who', headerName: t('admin.col.who'), width: 170,
      renderCell: (p) => <Typography variant="body2" noWrap>{p.row.user?.name ?? '—'}</Typography>,
    },
    {
      field: 'createdAt', headerName: t('admin.col.created'), width: 170,
      renderCell: (p) => <Typography variant="body2" color="text.secondary">{fmtTime(p.row.createdAt)}</Typography>,
    },
  ];

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
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={(r) => r.id}
            autoHeight
            hideFooter
            disableRowSelectionOnClick
            rowHeight={60}
            columnVisibilityModel={phone ? { who: false } : {}}
            sx={dataGridSx}
          />
          <LoadMoreButton hasMore={hasMore} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
        </>
      )}
    </>
  );
}
