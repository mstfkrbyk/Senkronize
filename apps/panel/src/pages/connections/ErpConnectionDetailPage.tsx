import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  TestTube2,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { SyncMonitorPanel } from '@/components/connections/SyncMonitorPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBreadcrumbTail } from '@/hooks/useBreadcrumbTail';
import {
  useErpConnections,
  useTestErpConnectionById,
  type ErpTestConnectionResult,
} from '@/hooks/useErpConnections';
import {
  useErpSyncSettings,
  useTriggerErpSyncNow,
  useUpsertErpSyncSettings,
  type ErpSyncFrequency,
  type ErpSyncScope,
  type ErpSyncSettingsDto,
  type UpsertErpSyncSettingsInput,
} from '@/hooks/useErpSyncSettings';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  circuitBreakerBadgeClass,
  deriveHealthFromConnection,
  statusBadgeClass,
  statusLabel,
} from '@/pages/connections/connection-utils';
import { getErpBranding } from '@/pages/connections/erp-display';
import { useSyncMonitorStore } from '@/store/syncMonitor.store';
import type { SyncLogEntry, SyncLogStatus } from '@/types/sync-log';

const FREQUENCY_OPTIONS: { value: ErpSyncFrequency; label: string }[] = [
  { value: 'MANUAL', label: 'Manuel' },
  { value: 'EVERY_5_MIN', label: '5 dk' },
  { value: 'EVERY_15_MIN', label: '15 dk' },
  { value: 'EVERY_30_MIN', label: '30 dk' },
  { value: 'HOURLY', label: '1 saat' },
  { value: 'EVERY_4_HOURS', label: '4 saat' },
  { value: 'DAILY', label: 'Günlük' },
];

const SYNC_SCOPE_OPTIONS: { value: ErpSyncScope; label: string }[] = [
  { value: 'all', label: 'Tüm Veriler' },
  { value: 'products', label: 'Sadece Ürünler' },
  { value: 'stock', label: 'Sadece Stok' },
  { value: 'invoices', label: 'Sadece Faturalar' },
];

const ERP_JOB_LABELS: Record<string, string> = {
  products: 'Ürün',
  stock: 'Stok',
  invoices: 'Fatura',
  orders: 'Sipariş',
  price: 'Fiyat',
};

type SyncHistoryFilterStatus = 'all' | SyncLogStatus;
type SyncHistoryFilterType = 'all' | 'products' | 'stock' | 'invoices';

type IntegrationLogLevel = 'INFO' | 'WARN' | 'ERROR';

interface IntegrationLogEntry {
  id: string;
  at: string;
  level: IntegrationLogLevel;
  message: string;
}

function statusBadge(status: SyncLogStatus): ReactElement {
  const map: Record<
    SyncLogStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    RUNNING: { label: 'Çalışıyor', variant: 'secondary' },
    SUCCESS: { label: 'Başarılı', variant: 'default' },
    PARTIAL: { label: 'Kısmi', variant: 'outline' },
    FAILED: { label: 'Hata', variant: 'destructive' },
  };
  const c = map[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function erpJobTypeFromLog(jobType: string): string {
  const parts = jobType.split(':');
  return parts.length >= 3 ? (parts[2] ?? jobType) : jobType;
}

function erpJobLabel(jobType: string): string {
  const type = erpJobTypeFromLog(jobType);
  return ERP_JOB_LABELS[type] ?? type;
}

function erpJobDirection(jobType: string): string {
  const type = erpJobTypeFromLog(jobType);
  if (type === 'invoices' || type === 'orders') {
    return 'Senkronize → ERP';
  }
  return 'ERP → Senkronize';
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

function formatTestResult(res: ErpTestConnectionResult): string {
  const parts: string[] = [];
  if (res.responseTimeMs !== undefined) {
    parts.push(`${res.responseTimeMs} ms`);
  }
  if (res.version) {
    parts.push(`v${res.version}`);
  }
  if (res.companyName) {
    parts.push(res.companyName);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Bağlantı testi başarılı.';
}

function settingsToForm(settings: ErpSyncSettingsDto): UpsertErpSyncSettingsInput {
  return {
    syncFrequency: settings.syncFrequency,
    syncStock: settings.syncStock,
    syncProducts: settings.syncProducts,
    syncInvoices: settings.syncInvoices,
    syncPrices: settings.syncPrices ?? settings.syncProducts,
    syncOrders: settings.syncOrders ?? settings.syncInvoices,
    syncCustomers: settings.syncCustomers ?? false,
    autoInvoiceOnDelivered: settings.autoInvoiceOnDelivered ?? false,
  };
}

function syncLogToLevel(status: SyncLogStatus): IntegrationLogLevel {
  if (status === 'FAILED') {
    return 'ERROR';
  }
  if (status === 'PARTIAL') {
    return 'WARN';
  }
  return 'INFO';
}

function buildIntegrationLogs(logs: SyncLogEntry[], lastError: string | null): IntegrationLogEntry[] {
  const fromLogs: IntegrationLogEntry[] = logs.map((log) => ({
    id: log.id,
    at: log.startedAt,
    level: syncLogToLevel(log.status),
    message:
      log.errorMessage ??
      `${erpJobLabel(log.jobType)} senkronu ${log.status === 'SUCCESS' ? 'tamamlandı' : log.status === 'RUNNING' ? 'devam ediyor' : 'güncellendi'} (${log.itemsProcessed} kayıt)`,
  }));

  if (lastError) {
    fromLogs.unshift({
      id: 'connection-error',
      at: new Date().toISOString(),
      level: 'ERROR',
      message: lastError,
    });
  }

  return fromLogs.slice(0, 50);
}

function healthDotClass(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    inactive: 'bg-slate-400',
  };
  return map[status] ?? 'bg-slate-400';
}

export function ErpConnectionDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const connectionId = id ?? null;

  const connectionsQuery = useErpConnections();
  const settingsQuery = useErpSyncSettings(connectionId);
  const saveSettings = useUpsertErpSyncSettings(connectionId ?? '');
  const syncNow = useTriggerErpSyncNow(connectionId ?? '');
  const testErp = useTestErpConnectionById(connectionId ?? '');

  const [activeTab, setActiveTab] = useState('overview');
  const [syncScope, setSyncScope] = useState<ErpSyncScope>('all');
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<SyncHistoryFilterType>('all');
  const [historyStatusFilter, setHistoryStatusFilter] =
    useState<SyncHistoryFilterStatus>('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [errorLog, setErrorLog] = useState<SyncLogEntry | null>(null);

  const upsertRunning = useSyncMonitorStore((s) => s.upsertRunning);
  const monitorEntries = useSyncMonitorStore((s) => s.entries);
  const activeMonitor = useMemo(() => {
    if (!connectionId) {
      return null;
    }
    return (
      Object.values(monitorEntries).find(
        (entry) => entry.connectionId === connectionId && entry.status === 'running',
      ) ?? null
    );
  }, [connectionId, monitorEntries]);

  const connection = connectionsQuery.data?.find((c) => c.id === connectionId);
  const branding = connection ? getErpBranding(connection.erpType) : null;
  const pageTitle = branding ? `${branding.label} — ERP` : 'ERP bağlantısı';

  usePageTitle(pageTitle);
  useBreadcrumbTail(pageTitle);

  const [form, setForm] = useState<UpsertErpSyncSettingsInput>({
    syncFrequency: 'HOURLY',
    syncStock: true,
    syncProducts: true,
    syncInvoices: false,
    syncPrices: true,
    syncOrders: false,
    syncCustomers: false,
    autoInvoiceOnDelivered: false,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsToForm(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const logsQuery = useQuery({
    queryKey: ['erp-sync-logs', connectionId],
    enabled: connectionId !== null,
    refetchInterval: syncNow.isPending || activeMonitor ? 3000 : false,
    queryFn: async (): Promise<SyncLogEntry[]> => {
      const params = new URLSearchParams({
        jobTypeStartsWith: `erp:${connectionId}:`,
        limit: '50',
      });
      const { data } = await api.get<{ data: SyncLogEntry[] }>(
        `/sync/logs?${params.toString()}`,
      );
      return data.data;
    },
  });

  const health = useMemo(() => {
    if (!connection) {
      return null;
    }
    return deriveHealthFromConnection(connection, logsQuery.data ?? []);
  }, [connection, logsQuery.data]);

  const lastSuccessLog = useMemo(
    () =>
      logsQuery.data?.find(
        (log) => log.status === 'SUCCESS' || log.status === 'PARTIAL',
      ) ?? null,
    [logsQuery.data],
  );

  const lastFailedLog = useMemo(
    () => logsQuery.data?.find((log) => log.status === 'FAILED') ?? null,
    [logsQuery.data],
  );

  const filteredHistory = useMemo(() => {
    let rows = logsQuery.data ?? [];
    if (historyTypeFilter !== 'all') {
      rows = rows.filter((log) => erpJobTypeFromLog(log.jobType) === historyTypeFilter);
    }
    if (historyStatusFilter !== 'all') {
      rows = rows.filter((log) => log.status === historyStatusFilter);
    }
    if (historyDateFrom) {
      const from = new Date(historyDateFrom).getTime();
      rows = rows.filter((log) => new Date(log.startedAt).getTime() >= from);
    }
    if (historyDateTo) {
      const to = new Date(historyDateTo).getTime() + 24 * 60 * 60 * 1000;
      rows = rows.filter((log) => new Date(log.startedAt).getTime() <= to);
    }
    return rows;
  }, [
    logsQuery.data,
    historyTypeFilter,
    historyStatusFilter,
    historyDateFrom,
    historyDateTo,
  ]);

  const integrationLogs = useMemo(
    () => buildIntegrationLogs(logsQuery.data ?? [], connection?.lastErrorMessage ?? null),
    [logsQuery.data, connection?.lastErrorMessage],
  );

  const ratePct =
    health && health.rateLimit.limit > 0
      ? Math.round((health.rateLimit.used / health.rateLimit.limit) * 100)
      : 0;

  const handleTest = (): void => {
    if (!connectionId) {
      return;
    }
    setTestResult(null);
    testErp.mutate(undefined, {
      onSuccess: (res) => {
        if (res.connected) {
          setTestResult({ ok: true, message: formatTestResult(res) });
        } else {
          setTestResult({
            ok: false,
            message: res.message ?? 'Bağlantı testi başarısız oldu.',
          });
        }
      },
      onError: (error) => {
        setTestResult({
          ok: false,
          message: getApiErrorMessage(error),
        });
      },
    });
  };

  const handleSave = (): void => {
    if (!connectionId) {
      return;
    }
    saveSettings.mutate(form, {
      onSuccess: () => {
        toast.success('Senkron ayarları kaydedildi.');
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  const handleSyncNow = (): void => {
    if (!connectionId || !connection) {
      return;
    }
    upsertRunning({
      key: connectionId,
      connectionId,
      platform: connection.erpType,
      phase: syncScope === 'all' ? 'tüm veriler' : syncScope,
      current: 0,
      total: 100,
    });
    syncNow.mutate(syncScope, {
      onSuccess: (res) => {
        toast.success(res.message || 'Senkron işi kuyruğa alındı.');
        void logsQuery.refetch();
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  if (connectionsQuery.isLoading || settingsQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (connectionsQuery.isError) {
    return (
      <div className="p-6 text-sm text-destructive">
        {getApiErrorMessage(connectionsQuery.error)}
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">ERP bağlantısı bulunamadı.</p>
        <Button variant="outline" asChild>
          <Link to="/connections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Bağlantılara dön
          </Link>
        </Button>
      </div>
    );
  }

  const lastSyncLabel =
    connection.lastSyncAt !== null
      ? formatDistanceToNow(new Date(connection.lastSyncAt), {
          addSuffix: true,
          locale: tr,
        })
      : 'Henüz senkron yok';

  const monitorPct =
    activeMonitor && activeMonitor.total > 0
      ? Math.min(100, Math.round((activeMonitor.current / activeMonitor.total) * 100))
      : syncNow.isPending
        ? 12
        : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/connections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Bağlantılar
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={syncScope}
            onValueChange={(v) => {
              setSyncScope(v as ErpSyncScope);
            }}
          >
            <SelectTrigger className="w-[180px]" aria-label="Senkron tipi">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYNC_SCOPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={syncNow.isPending || !connection.isActive}
            onClick={() => {
              handleSyncNow();
            }}
          >
            {syncNow.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Senkronize ediliyor…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Şimdi Sync Et
              </>
            )}
          </Button>
        </div>
      </div>

      {(syncNow.isPending || activeMonitor) && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Canlı senkron ilerlemesi</span>
              <span className="text-muted-foreground tabular-nums">{monitorPct}%</span>
            </div>
            <Progress value={monitorPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {activeMonitor?.phase ?? syncScope} · WebSocket üzerinden güncellenir
            </p>
          </CardContent>
        </Card>
      )}

      <SyncMonitorPanel />

      <div className="flex flex-wrap items-start gap-3">
        <span className="text-3xl" aria-hidden>
          {branding?.logo}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{branding?.label}</h1>
          <p className="text-sm text-muted-foreground">
            {branding?.accountFieldLabel}: {connection.accountLabel ?? '—'}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="settings">Sync Ayarları</TabsTrigger>
          <TabsTrigger value="history">Sync Geçmişi</TabsTrigger>
          <TabsTrigger value="logs">Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bağlantı bilgileri</CardTitle>
              <CardDescription>ERP tipi, sunucu ve son test sonucu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">ERP tipi</p>
                  <p className="font-medium">{branding?.label}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sunucu / domain</p>
                  <p className="font-medium break-all">{connection.accountLabel ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Son bağlantı testi</p>
                  <p className="font-medium">
                    {testResult
                      ? testResult.message
                      : connection.isActive
                        ? 'Test edilmedi'
                        : 'Pasif'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Son senkron</p>
                  <p className="font-medium">{lastSyncLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Oluşturulma</p>
                  <p className="font-medium">
                    {format(new Date(connection.createdAt), 'd MMM yyyy', { locale: tr })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Durum</p>
                  {health ? (
                    <Badge variant="outline" className={statusBadgeClass(health.status)}>
                      {statusLabel(health.status)}
                    </Badge>
                  ) : (
                    <span className="font-medium">—</span>
                  )}
                </div>
              </div>

              {settingsQuery.data?.nextSyncAt &&
              settingsQuery.data.syncFrequency !== 'MANUAL' ? (
                <p className="text-muted-foreground">
                  Sonraki planlı senkron:{' '}
                  {format(new Date(settingsQuery.data.nextSyncAt), 'd MMM yyyy HH:mm', {
                    locale: tr,
                  })}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testErp.isPending}
                  onClick={() => {
                    handleTest();
                  }}
                >
                  {testErp.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube2 className="mr-2 h-4 w-4" />
                  )}
                  Test Bağlantısı
                </Button>
              </div>
              {testResult ? (
                <p
                  className={`rounded-md border px-3 py-2 text-sm ${
                    testResult.ok
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {testResult.message}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sağlık durumu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {health ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-3 w-3 rounded-full ${healthDotClass(health.status)}`}
                        aria-hidden
                      />
                      <Badge variant="outline" className={statusBadgeClass(health.status)}>
                        {statusLabel(health.status)}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Rate limit</span>
                        <span className="font-medium tabular-nums">
                          {health.rateLimit.used} / {health.rateLimit.limit}
                        </span>
                      </div>
                      <Progress value={ratePct} className="h-2" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Circuit breaker</span>
                      <Badge
                        variant="outline"
                        className={circuitBreakerBadgeClass(health.circuitBreaker)}
                      >
                        {health.circuitBreaker}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <Skeleton className="h-20 w-full" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Son sync özeti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Son başarılı</p>
                  <p className="font-medium">
                    {lastSuccessLog
                      ? `${erpJobLabel(lastSuccessLog.jobType)} · ${format(
                          new Date(lastSuccessLog.startedAt),
                          'd MMM yyyy HH:mm',
                          { locale: tr },
                        )} · ${lastSuccessLog.itemsProcessed} kayıt`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Son hata</p>
                  <p className="font-medium text-red-800">
                    {lastFailedLog
                      ? `${erpJobLabel(lastFailedLog.jobType)} · ${format(
                          new Date(lastFailedLog.startedAt),
                          'd MMM yyyy HH:mm',
                          { locale: tr },
                        )}${lastFailedLog.errorMessage ? ` — ${lastFailedLog.errorMessage}` : ''}`
                      : connection.lastErrorMessage ?? '—'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Senkron ayarları</CardTitle>
              <CardDescription>
                ERP verilerinin ne sıklıkla ve hangi türlerde senkronize edileceğini belirleyin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Sync sıklığı</Label>
                <div
                  className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                  role="radiogroup"
                  aria-label="Senkron sıklığı"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={form.syncFrequency === opt.value}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        form.syncFrequency === opt.value
                          ? 'border-primary bg-primary/5 font-medium'
                          : 'border-border hover:border-primary/40'
                      }`}
                      onClick={() => {
                        setForm((f) => ({ ...f, syncFrequency: opt.value }));
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label>Sync edilecek veriler</Label>
                {[
                  {
                    key: 'syncProducts' as const,
                    title: 'Ürünler',
                    desc: 'ERP → Senkronize',
                  },
                  {
                    key: 'syncStock' as const,
                    title: 'Stok',
                    desc: 'ERP → Senkronize',
                  },
                  {
                    key: 'syncPrices' as const,
                    title: 'Fiyatlar',
                    desc: 'ERP → Senkronize',
                  },
                  {
                    key: 'syncOrders' as const,
                    title: 'Siparişler',
                    desc: 'Senkronize → ERP fatura',
                  },
                  {
                    key: 'syncCustomers' as const,
                    title: 'Müşteriler',
                    desc: 'Senkronize → ERP cari',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={form[item.key] ?? false}
                      onCheckedChange={(v) => {
                        setForm((f) => ({ ...f, [item.key]: v }));
                      }}
                      aria-label={item.title}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Otomatik fatura oluşturma</p>
                    <p className="text-xs text-muted-foreground">
                      Teslim edildi durumunda otomatik fatura oluştur
                    </p>
                  </div>
                  <Switch
                    checked={form.autoInvoiceOnDelivered ?? false}
                    onCheckedChange={(v) => {
                      setForm((f) => ({ ...f, autoInvoiceOnDelivered: v }));
                    }}
                    aria-label="Otomatik fatura oluşturma"
                  />
                </div>
              </div>

              <Button
                type="button"
                disabled={saveSettings.isPending}
                onClick={() => {
                  handleSave();
                }}
              >
                {saveSettings.isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sync geçmişi</CardTitle>
              <CardDescription>Bu bağlantı için senkron işlem kayıtları</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="hist-from">Başlangıç</Label>
                  <Input
                    id="hist-from"
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => {
                      setHistoryDateFrom(e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hist-to">Bitiş</Label>
                  <Input
                    id="hist-to"
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => {
                      setHistoryDateTo(e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tip</Label>
                  <Select
                    value={historyTypeFilter}
                    onValueChange={(v) => {
                      setHistoryTypeFilter(v as SyncHistoryFilterType);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü</SelectItem>
                      <SelectItem value="products">Ürün</SelectItem>
                      <SelectItem value="stock">Stok</SelectItem>
                      <SelectItem value="invoices">Fatura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Durum</Label>
                  <Select
                    value={historyStatusFilter}
                    onValueChange={(v) => {
                      setHistoryStatusFilter(v as SyncHistoryFilterStatus);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü</SelectItem>
                      <SelectItem value="SUCCESS">Başarılı</SelectItem>
                      <SelectItem value="PARTIAL">Kısmi</SelectItem>
                      <SelectItem value="FAILED">Hatalı</SelectItem>
                      <SelectItem value="RUNNING">Çalışıyor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {logsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kayıtlar yükleniyor…
                </div>
              ) : null}
              {logsQuery.isError ? (
                <p className="text-sm text-destructive">{getApiErrorMessage(logsQuery.error)}</p>
              ) : null}
              {!logsQuery.isLoading && filteredHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
              ) : null}
              {filteredHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Yön</TableHead>
                      <TableHead>Kayıt</TableHead>
                      <TableHead>Süre</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((log) => (
                      <TableRow
                        key={log.id}
                        className={log.errorMessage ? 'cursor-pointer hover:bg-muted/50' : undefined}
                        onClick={() => {
                          if (log.errorMessage) {
                            setErrorLog(log);
                          }
                        }}
                      >
                        <TableCell>
                          {format(new Date(log.startedAt), 'd MMM yyyy HH:mm', { locale: tr })}
                        </TableCell>
                        <TableCell>{erpJobLabel(log.jobType)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {erpJobDirection(log.jobType)}
                        </TableCell>
                        <TableCell>
                          {log.status === 'FAILED' || log.itemsFailed > 0
                            ? `${log.itemsProcessed} / ${log.itemsFailed} hata`
                            : `${log.itemsProcessed} başarılı`}
                        </TableCell>
                        <TableCell>{formatDuration(log.durationMs)}</TableCell>
                        <TableCell>{statusBadge(log.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Log</CardTitle>
              <CardDescription>Son 50 entegrasyon log girişi</CardDescription>
            </CardHeader>
            <CardContent>
              {logsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loglar yükleniyor…
                </div>
              ) : null}
              {integrationLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz log kaydı yok.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {integrationLogs.map((entry) => (
                    <li
                      key={entry.id}
                      className={`flex flex-wrap items-start gap-3 px-3 py-2 text-sm ${
                        entry.level === 'ERROR'
                          ? 'bg-red-50 text-red-900'
                          : entry.level === 'WARN'
                            ? 'bg-amber-50/60'
                            : ''
                      }`}
                    >
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {format(new Date(entry.at), 'HH:mm:ss', { locale: tr })}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          entry.level === 'ERROR'
                            ? 'border-red-300 text-red-800'
                            : entry.level === 'WARN'
                              ? 'border-amber-300 text-amber-800'
                              : ''
                        }
                      >
                        {entry.level}
                      </Badge>
                      <span className="min-w-0 flex-1">{entry.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={errorLog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setErrorLog(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hata detayı</DialogTitle>
            <DialogDescription>
              {errorLog
                ? format(new Date(errorLog.startedAt), 'd MMM yyyy HH:mm', { locale: tr })
                : null}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-red-800">{errorLog?.errorMessage ?? '—'}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
