import type { ReactElement, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Info, Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { SyncAccountingModeBanner } from '@/components/sync/SyncAccountingModeBanner';
import { SyncContextCards } from '@/components/sync/SyncContextCards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useErpConnections } from '@/hooks/useErpConnections';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { NAV_GROUP_LABEL_KEYS } from '@/lib/nav-match';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { isBundleOrg } from '@/lib/org-products';
import { cn } from '@/lib/utils';
import { resolveConnectionsProductAccess } from '@/pages/connections/connections-product-access';
import { erpConnectionDisplayName } from '@/lib/erp-connection-display';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import { resolveSyncLogsNavGroupId } from '@/pages/sync-logs/sync-logs-nav-context';
import { useAuthStore } from '@/store/auth.store';
import type { SyncLogEntry, SyncLogStatus } from '@/types/sync-log';

interface SyncHealthRow {
  organizationId: string;
  platform: string;
  lastSuccessAt: string | null;
  errorCount: number;
  status: 'healthy' | 'warning' | 'error';
}

type LogScopeTab = 'channel' | 'erp';

const CHANNEL_LOG_LIMIT = 100;
const ERP_LOG_LIMIT = 50;

const CHANNEL_JOB_LABELS: Record<string, string> = {
  orders: 'Siparişler',
  stock: 'Stok',
  price: 'Fiyat',
  listings: 'İlanlar',
  returns: 'İadeler',
};

const ERP_JOB_LABELS: Record<string, string> = {
  orders: 'Sipariş',
  invoices: 'Fatura',
  products: 'Ürün',
  customers: 'Cari',
  stock: 'Stok',
};

function statusBadgeVariant(
  status: SyncHealthRow['status'],
): 'default' | 'secondary' | 'destructive' {
  if (status === 'healthy') {
    return 'default';
  }
  if (status === 'warning') {
    return 'secondary';
  }
  return 'destructive';
}

function healthStatusLabel(status: SyncHealthRow['status']): string {
  if (status === 'healthy') {
    return 'Sağlıklı';
  }
  if (status === 'warning') {
    return 'Uyarı';
  }
  return 'Hata';
}

function syncLogStatusBadge(status: SyncLogStatus): ReactElement {
  const map: Record<
    SyncLogStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    RUNNING: { label: 'Çalışıyor', variant: 'secondary' },
    SUCCESS: { label: 'Başarılı', variant: 'default' },
    PARTIAL: { label: 'Kısmi', variant: 'outline' },
    FAILED: { label: 'Hata', variant: 'destructive' },
  };
  const config = map[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatDuration(ms: number | null): string {
  if (ms === null) {
    return '—';
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const sec = Math.round(ms / 1000);
  if (sec < 60) {
    return `${sec} sn`;
  }
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min} dk ${rem} sn` : `${min} dk`;
}

function formatLogTime(iso: string): string {
  try {
    return format(new Date(iso), 'dd.MM.yyyy HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

function isErpJobType(jobType: string): boolean {
  return jobType.startsWith('erp:');
}

function erpJobTypeSegment(jobType: string): string {
  const parts = jobType.split(':');
  if (parts.length === 4) {
    return parts[3] ?? jobType;
  }
  if (parts.length >= 3) {
    return parts[2] ?? jobType;
  }
  return jobType;
}

function erpConnectionIdFromJobType(jobType: string): string | null {
  const parts = jobType.split(':');
  if (parts.length === 4) {
    return parts[2] ?? null;
  }
  if (parts.length >= 2) {
    return parts[1] ?? null;
  }
  return null;
}

function channelJobLabel(jobType: string): string {
  return CHANNEL_JOB_LABELS[jobType] ?? jobType;
}

function erpJobLabel(jobType: string): string {
  return ERP_JOB_LABELS[erpJobTypeSegment(jobType)] ?? erpJobTypeSegment(jobType);
}

function marketplacePlatformCell(platform: string): ReactNode {
  const branding = getMarketplaceBranding(platform);
  return (
    <span className="flex items-center gap-2">
      {branding.logo}
      {branding.label}
    </span>
  );
}

interface SyncLogsBundleNativeGuideProps {
  className?: string;
}

function SyncLogsBundleNativeGuide({
  className,
}: SyncLogsBundleNativeGuideProps): ReactElement {
  const { t } = useTranslation();

  return (
    <Card
      className={cn(
        'border-sky-200 bg-sky-50/70 text-sky-950 shadow-none',
        className,
      )}
    >
      <CardContent className="flex gap-3 p-4 sm:p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-semibold leading-snug text-sky-950">
            {t('sync.logs.bundleNative.title')}
          </p>
          <p className="text-sm leading-relaxed text-sky-900/90">
            {t('sync.logs.bundleNative.body')}
          </p>
          <p>
            <Link
              to="/accounting"
              className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
            >
              {t('sync.logs.bundleNative.accountingLink')}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface SyncLogsTableProps {
  rows: SyncLogEntry[];
  scope: LogScopeTab;
  erpConnectionNames: Map<string, string>;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  emptyMessage: string;
}

function SyncLogsTable({
  rows,
  scope,
  erpConnectionNames,
  isLoading,
  isError,
  error,
  emptyMessage,
}: SyncLogsTableProps): ReactElement {
  const { t } = useTranslation();

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('sync.logs.table.time')}</TableHead>
            <TableHead>{t('sync.logs.table.platform')}</TableHead>
            <TableHead>{t('sync.logs.table.jobType')}</TableHead>
            <TableHead>{t('sync.logs.table.status')}</TableHead>
            <TableHead className="text-right">{t('sync.logs.table.processed')}</TableHead>
            <TableHead className="text-right">{t('sync.logs.table.failed')}</TableHead>
            <TableHead className="text-right">{t('sync.logs.table.duration')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatLogTime(row.startedAt)}
              </TableCell>
              <TableCell className="text-sm">
                {scope === 'erp' ? (
                  <ErpConnectionCell
                    jobType={row.jobType}
                    connectionNames={erpConnectionNames}
                  />
                ) : (
                  marketplacePlatformCell(row.platform)
                )}
              </TableCell>
              <TableCell className="text-sm">
                {scope === 'erp' ? erpJobLabel(row.jobType) : channelJobLabel(row.jobType)}
              </TableCell>
              <TableCell>{syncLogStatusBadge(row.status)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.itemsProcessed}</TableCell>
              <TableCell className="text-right tabular-nums">{row.itemsFailed}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatDuration(row.durationMs)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
  );
}

function ErpConnectionCell({
  jobType,
  connectionNames,
}: {
  jobType: string;
  connectionNames: Map<string, string>;
}): ReactNode {
  const connectionId = erpConnectionIdFromJobType(jobType);
  const label =
    connectionId !== null ? connectionNames.get(connectionId) : undefined;
  if (label) {
    return <span className="font-medium">{label}</span>;
  }
  return <span className="font-mono text-xs text-muted-foreground">{jobType}</span>;
}

export function SyncLogsPage(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode, isLoading: accountingModeLoading } =
    useAccountingMode();
  const erpConnectionsQuery = useErpConnections();
  const [scopeTab, setScopeTab] = useState<LogScopeTab>('channel');

  const productAccess = useMemo(
    () => resolveConnectionsProductAccess(orgProducts),
    [orgProducts],
  );
  const navGroupId = useMemo(
    () =>
      resolveSyncLogsNavGroupId(
        productAccess,
        accountingMode,
        scopeTab,
      ),
    [productAccess, accountingMode, scopeTab],
  );
  const navContextLine = formatNavPageContext(
    t(NAV_GROUP_LABEL_KEYS[navGroupId]),
    t('nav.syncLogs'),
  );
  usePageTitle(t('nav.syncLogs'));

  const showErpTab = accountingMode === 'EXTERNAL_ERP';
  const showBundleNativeGuide =
    !accountingModeLoading &&
    accountingMode === 'NATIVE' &&
    isBundleOrg(orgProducts);

  const erpConnectionNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of erpConnectionsQuery.data ?? []) {
      map.set(c.id, erpConnectionDisplayName(c));
    }
    return map;
  }, [erpConnectionsQuery.data]);

  const statusQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: async (): Promise<SyncHealthRow[]> => {
      const { data } = await api.get<SyncHealthRow[]>('/sync/status');
      return data;
    },
  });

  const channelLogsQuery = useQuery({
    queryKey: ['sync-logs', 'channel'],
    queryFn: async (): Promise<SyncLogEntry[]> => {
      const params = new URLSearchParams({
        limit: String(CHANNEL_LOG_LIMIT),
      });
      const { data } = await api.get<{ data: SyncLogEntry[] }>(
        `/sync/logs?${params.toString()}`,
      );
      return data.data.filter((row) => !isErpJobType(row.jobType)).slice(0, 50);
    },
  });

  const erpLogsQuery = useQuery({
    queryKey: ['sync-logs', 'erp'],
    enabled: scopeTab === 'erp' && showErpTab,
    queryFn: async (): Promise<SyncLogEntry[]> => {
      const params = new URLSearchParams({
        jobTypeStartsWith: 'erp:',
        limit: String(ERP_LOG_LIMIT),
      });
      const { data } = await api.get<{ data: SyncLogEntry[] }>(
        `/sync/logs?${params.toString()}`,
      );
      return data.data;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (): Promise<{ jobIds: string[]; message: string }> => {
      const { data } = await api.post<{ jobIds: string[]; message: string }>(
        '/listings/sync',
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const handleScopeChange = (value: string): void => {
    if (value === 'channel' || value === 'erp') {
      setScopeTab(value);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('sync.logs.title')}
        description={t('sync.logs.subtitle')}
        context={navContextLine}
        actions={
          scopeTab === 'channel' ? (
            <Button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <Plug className="mr-2 h-4 w-4" aria-hidden />
              {t('sync.logs.manualSync')}
            </Button>
          ) : undefined
        }
      />

      <SyncAccountingModeBanner />

      {showBundleNativeGuide ? <SyncLogsBundleNativeGuide /> : null}

      <SyncContextCards showErpContext={showErpTab} />

      <Card>
        <CardContent className="pt-6">
      <Tabs value={scopeTab} onValueChange={handleScopeChange}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="channel">{t('sync.logs.tabs.channel')}</TabsTrigger>
          {showErpTab ? (
            <TabsTrigger value="erp">{t('sync.logs.tabs.erp')}</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="channel" className="mt-4 space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t('sync.logs.channelHealth')}</h2>
            {statusQuery.isError ? (
              <p className="text-sm text-destructive">
                {getApiErrorMessage(statusQuery.error)}
              </p>
            ) : null}
            {statusQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
              </div>
            ) : (statusQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('sync.logs.noHealth')}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(statusQuery.data ?? []).map((row) => {
                  const branding = getMarketplaceBranding(row.platform);
                  return (
                    <Card key={row.platform}>
                      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          {branding.logo}
                          <CardTitle className="text-base font-medium">
                            {branding.label}
                          </CardTitle>
                        </div>
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {healthStatusLabel(row.status)}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          Son başarı:{' '}
                          {row.lastSuccessAt
                            ? formatDistanceToNow(new Date(row.lastSuccessAt), {
                                addSuffix: true,
                                locale: tr,
                              })
                            : '—'}
                        </p>
                        <p>Hata sayısı: {row.errorCount}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('sync.logs.recordsTitle')}</CardTitle>
              <CardDescription>{t('sync.logs.recordsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <SyncLogsTable
                rows={channelLogsQuery.data ?? []}
                scope="channel"
                erpConnectionNames={erpConnectionNames}
                isLoading={channelLogsQuery.isLoading}
                isError={channelLogsQuery.isError}
                error={channelLogsQuery.error}
                emptyMessage={t('sync.logs.noLogs')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {showErpTab ? (
          <TabsContent value="erp" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('sync.logs.recordsTitle')}</CardTitle>
                <CardDescription>{t('sync.logs.recordsDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SyncLogsTable
                  rows={erpLogsQuery.data ?? []}
                  scope="erp"
                  erpConnectionNames={erpConnectionNames}
                  isLoading={erpLogsQuery.isLoading}
                  isError={erpLogsQuery.isError}
                  error={erpLogsQuery.error}
                  emptyMessage={t('sync.logs.erpEmpty')}
                />
                {(erpLogsQuery.data?.length ?? 0) === 0 &&
                !erpLogsQuery.isLoading &&
                !erpLogsQuery.isError ? (
                  <p>
                    <Link
                      to="/connections?tab=erp"
                      className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
                    >
                      {t('sync.logs.erpConnectionsLink')}
                    </Link>
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
