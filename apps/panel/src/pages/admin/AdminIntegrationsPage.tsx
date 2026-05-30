import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import { filterIntegrations } from '@/pages/admin/admin-integration.utils';
import type { AdminIntegrationListItem } from '@/types/admin';

function healthBadgeVariant(
  score: number,
): 'default' | 'secondary' | 'destructive' {
  if (score >= 100) {
    return 'default';
  }
  if (score >= 50) {
    return 'secondary';
  }
  return 'destructive';
}

export function AdminIntegrationsPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  const listQuery = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: async (): Promise<AdminIntegrationListItem[]> => {
      const { data } = await api.get<AdminIntegrationListItem[]>('/admin/integrations');
      return Array.isArray(data) ? data : [];
    },
  });

  const filtered = useMemo(
    () => filterIntegrations(listQuery.data ?? [], search, category),
    [listQuery.data, search, category],
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.pages.integrations.title')}
        description={t('admin.pages.integrations.description')}
        showBreadcrumbParent
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={listQuery.isFetching}
            onClick={() => {
              void listQuery.refetch();
            }}
          >
            {listQuery.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            )}
            {t('admin.common.refresh')}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.pages.integrations.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.pages.integrations.searchPlaceholder')}
              className="sm:max-w-xs"
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('admin.common.all')}</SelectItem>
                <SelectItem value="MARKETPLACE">
                  {t('admin.pages.integrations.categories.marketplace')}
                </SelectItem>
                <SelectItem value="ECOMMERCE">
                  {t('admin.pages.integrations.categories.ecommerce')}
                </SelectItem>
                <SelectItem value="ERP">{t('admin.pages.integrations.categories.erp')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('admin.pages.integrations.openHint')}
          </p>

          {listQuery.isLoading ? <TableSkeleton rows={8} cols={7} /> : null}
          {listQuery.isError ? (
            <QueryErrorAlert
              error={listQuery.error}
              onRetry={() => {
                void listQuery.refetch();
              }}
            />
          ) : null}

          {!listQuery.isLoading && !listQuery.isError ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.pages.integrations.table.name')}</TableHead>
                  <TableHead>{t('admin.pages.integrations.table.category')}</TableHead>
                  <TableHead>{t('admin.pages.integrations.table.health')}</TableHead>
                  <TableHead>{t('admin.pages.integrations.table.rpm')}</TableHead>
                  <TableHead className="text-right">
                    {t('admin.pages.integrations.table.requestsToday')}
                  </TableHead>
                  <TableHead>{t('admin.pages.integrations.table.status')}</TableHead>
                  <TableHead>{t('admin.pages.integrations.table.circuit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow
                    key={row.platformKey}
                    className="cursor-pointer"
                    onDoubleClick={() => {
                      navigate(`/admin/integrations/${encodeURIComponent(row.platformKey)}`);
                    }}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.displayName}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {row.platformKey}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{row.categoryLabel}</TableCell>
                    <TableCell>
                      <Badge variant={healthBadgeVariant(row.health.healthScore)}>
                        %{row.health.healthScore}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{row.effectiveRpm}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.requestsToday}
                    </TableCell>
                    <TableCell>
                      {row.enabled ? (
                        <Badge variant="outline">{t('admin.pages.integrations.enabled')}</Badge>
                      ) : (
                        <Badge variant="secondary">
                          {t('admin.pages.integrations.disabled')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {t(`admin.pages.integrations.circuitState.${row.health.state}`)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
