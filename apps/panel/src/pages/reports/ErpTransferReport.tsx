import type { ReactElement } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowRightLeft, Clock, Plug, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
import type { ErpConnectionDto } from '@/hooks/useErpConnections';
import { getApiErrorMessage } from '@/lib/api';
import { getErpBranding } from '@/pages/connections/erp-display';
import type { SyncLogEntry, SyncLogStatus } from '@/types/sync-log';

import { useErpTransferReport } from './useErpTransferReport';

const RECENT_LOG_PREVIEW = 8;

function syncStatusBadge(status: SyncLogStatus): ReactElement {
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

function erpJobLabel(jobType: string): string {
  const parts = jobType.split(':');
  const type = parts.length >= 3 ? (parts[2] ?? jobType) : jobType;
  const labels: Record<string, string> = {
    orders: 'Sipariş',
    invoices: 'Fatura',
    products: 'Ürün',
    customers: 'Cari',
    stock: 'Stok',
  };
  return labels[type] ?? type;
}

function formatLastSync(iso: string | null): string {
  if (iso == null) {
    return 'Henüz senkron yok';
  }
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: tr });
}

function KpiCard({
  label,
  value,
  loading,
  icon: Icon,
}: {
  label: string;
  value: string;
  loading: boolean;
  icon: typeof Plug;
}): ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <p className="text-2xl font-semibold text-primary">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectionRow({ connection }: { connection: ErpConnectionDto }): ReactElement {
  const { label, logo } = getErpBranding(connection.erpType);
  const statusLabel = connection.isActive ? 'Aktif' : 'Pasif';
  const statusClass = connection.isActive
    ? 'border-green-200 bg-green-50 text-green-800'
    : 'border-slate-200 bg-slate-100 text-slate-700';

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <img src={logo} alt="" className="h-6 w-6 rounded object-contain" />
          <div>
            <p className="font-medium text-foreground">{label}</p>
            {connection.accountLabel ? (
              <p className="text-xs text-muted-foreground">{connection.accountLabel}</p>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusClass}>
          {statusLabel}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatLastSync(connection.lastSyncAt)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {connection.syncErrorCount > 0 ? (
          <span className="font-medium text-destructive">{connection.syncErrorCount}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to={`/connections/erp/${connection.id}`}>Detay</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function ErpTransferReport(): ReactElement {
  const { t } = useTranslation();
  const { connections, logs, summary, isLoading, isError, error } =
    useErpTransferReport();

  const recentLogs = logs.slice(0, RECENT_LOG_PREVIEW);

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-gradient-to-br from-slate-50/80 via-background to-sky-50/40">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-background text-sky-600">
            <ArrowRightLeft className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-base font-semibold text-primary">
              {t('reports.erpTransfer.title')}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t('reports.erpTransfer.description')}
            </CardDescription>
            {!isLoading ? (
              <p className="text-xs text-muted-foreground">
                {t('reports.erpTransfer.recentLogCount', {
                  count: summary.recentLogCount,
                })}
              </p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <Button type="button" size="sm" asChild>
            <Link to="/connections?tab=erp">
              <Plug className="mr-2 h-4 w-4" aria-hidden />
              {t('reports.erpTransfer.openConnections')}
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to="/sync-logs">{t('reports.erpTransfer.openSyncLogs')}</Link>
          </Button>
        </CardContent>
      </Card>

      {isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error != null ? getApiErrorMessage(error) : 'Veriler yüklenemedi.'}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label={t('reports.erpTransfer.kpi.connected')}
          value={
            summary.totalConnections === 0
              ? '0'
              : t('reports.erpTransfer.kpi.connectedValue', {
                  active: summary.activeConnections,
                  total: summary.totalConnections,
                })
          }
          loading={isLoading}
          icon={Plug}
        />
        <KpiCard
          label={t('reports.erpTransfer.kpi.lastSync')}
          value={formatLastSync(summary.lastSyncAt)}
          loading={isLoading}
          icon={Clock}
        />
        <KpiCard
          label={t('reports.erpTransfer.kpi.errors')}
          value={String(summary.totalSyncErrors)}
          loading={isLoading}
          icon={AlertTriangle}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reports.erpTransfer.connectionsTitle')}</CardTitle>
          <CardDescription>{t('reports.erpTransfer.connectionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : connections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {t('reports.erpTransfer.noConnectionsTitle')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('reports.erpTransfer.noConnectionsDescription')}
              </p>
              <Button type="button" size="sm" className="mt-4" asChild>
                <Link to="/connections?tab=erp">{t('reports.erpTransfer.openConnections')}</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reports.erpTransfer.table.erp')}</TableHead>
                  <TableHead>{t('reports.erpTransfer.table.status')}</TableHead>
                  <TableHead>{t('reports.erpTransfer.table.lastSync')}</TableHead>
                  <TableHead className="text-right">{t('reports.erpTransfer.table.errors')}</TableHead>
                  <TableHead className="text-right">{t('reports.erpTransfer.table.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection) => (
                  <ConnectionRow key={connection.id} connection={connection} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reports.erpTransfer.recentLogsTitle')}</CardTitle>
          <CardDescription>
            {t('reports.erpTransfer.recentLogsDescription', {
              failed: summary.failedLogCount,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('reports.erpTransfer.noRecentLogs')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reports.erpTransfer.logTable.status')}</TableHead>
                  <TableHead>{t('reports.erpTransfer.logTable.job')}</TableHead>
                  <TableHead>{t('reports.erpTransfer.logTable.started')}</TableHead>
                  <TableHead className="text-right">{t('reports.erpTransfer.logTable.items')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => (
                  <SyncLogRow key={log.id} log={log} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SyncLogRow({ log }: { log: SyncLogEntry }): ReactElement {
  const startedLabel = formatDistanceToNow(new Date(log.startedAt), {
    addSuffix: true,
    locale: tr,
  });

  return (
    <TableRow>
      <TableCell>{syncStatusBadge(log.status)}</TableCell>
      <TableCell className="font-medium">{erpJobLabel(log.jobType)}</TableCell>
      <TableCell className="text-muted-foreground">{startedLabel}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {log.itemsProcessed}
        {log.itemsFailed > 0 ? (
          <span className="ml-1 text-destructive">({log.itemsFailed} hata)</span>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
