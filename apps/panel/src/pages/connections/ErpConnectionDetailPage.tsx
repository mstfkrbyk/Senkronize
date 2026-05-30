import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  TestTube2,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { AccountingModeBadge } from '@/components/AccountingModeBadge';
import { PageHeader } from '@/components/PageHeader';
import { SyncMonitorPanel } from '@/components/connections/SyncMonitorPanel';
import { ConnectionProductMatchKeyCard } from '@/components/connections/ConnectionProductMatchKeyCard';
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
  useSetPrimaryErpConnection,
  useTestErpConnectionById,
  useUpdateErpConnection,
  type ErpTestConnectionResult,
} from '@/hooks/useErpConnections';
import {
  useErpSyncSettings,
  useTriggerErpSyncNow,
  useUpsertErpSyncSettings,
  type ErpProductImportMode,
  type ErpSyncFrequency,
  type ErpSyncScope,
  type ErpSyncSettingsDto,
  type UpsertErpSyncSettingsInput,
} from '@/hooks/useErpSyncSettings';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useIntegrationOpsAccess } from '@/hooks/useIntegrationOpsAccess';
import { customerConnectionStatusLabel } from '@/lib/integration-ops-access';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  formatConnectionTestFailureMessage,
  formatErpTestSuccessMessage,
  normalizeErpTestConnectionResult,
} from '@/lib/connection-test-message';
import { formatNavPageContext } from '@/lib/nav-page-context';
import {
  erpConnectionDisplayName,
  erpConnectionRoleHint,
  erpConnectionRoleLabel,
} from '@/lib/erp-connection-display';
import { NAV_GROUP_LABEL_KEYS } from '@/lib/nav-match';
import { useAuthStore } from '@/store/auth.store';
import {
  circuitBreakerBadgeClass,
  deriveHealthFromConnection,
  statusBadgeClass,
  statusLabel,
} from '@/pages/connections/connection-utils';
import {
  resolveConnectionsProductAccess,
  showExternalErpBridgeUi,
} from '@/pages/connections/connections-product-access';
import { ErpBridgeSection } from '@/pages/connections/ErpBridgeSection';
import { erpSyncScheduleLabel } from '@/pages/connections/connection-utils';
import { getErpBranding } from '@/pages/connections/erp-display';
import { useSyncMonitorStore } from '@/store/syncMonitor.store';
import type { SyncLogEntry, SyncLogStatus } from '@/types/sync-log';

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
  const c = map[status] ?? { label: status, variant: 'outline' as const };
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

const ERP_PRODUCT_IMPORT_MODES: ErpProductImportMode[] = [
  'ECOMMERCE_ONLY',
  'CATEGORY',
  'ALL',
];

function normalizeProductImportMode(
  value: ErpProductImportMode | string | null | undefined,
): ErpProductImportMode {
  if (value && ERP_PRODUCT_IMPORT_MODES.includes(value as ErpProductImportMode)) {
    return value as ErpProductImportMode;
  }
  return 'ECOMMERCE_ONLY';
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
    productImportMode: normalizeProductImportMode(settings.productImportMode),
    erpCategoryIds: settings.erpCategoryIds ?? [],
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
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const connectionId = id ?? null;
  const initialTab = searchParams.get('tab');
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const productAccess = useMemo(
    () => resolveConnectionsProductAccess(orgProducts),
    [orgProducts],
  );
  const { mode: accountingMode, isLoading: accountingModeLoading } =
    useAccountingMode();
  const externalErpUi = useMemo(
    () => showExternalErpBridgeUi(productAccess, accountingMode),
    [productAccess, accountingMode],
  );
  const opsAccess = useIntegrationOpsAccess();

  const connectionsQuery = useErpConnections();
  const settingsQuery = useErpSyncSettings(connectionId);
  const saveSettings = useUpsertErpSyncSettings(connectionId ?? '');
  const syncNow = useTriggerErpSyncNow(connectionId ?? '');
  const setPrimary = useSetPrimaryErpConnection();
  const testErp = useTestErpConnectionById(connectionId ?? '');
  const updateErpConnection = useUpdateErpConnection();

  const [activeTab, setActiveTab] = useState(() =>
    initialTab === 'settings' ||
    initialTab === 'history' ||
    initialTab === 'logs'
      ? initialTab
      : 'overview',
  );
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

  useEffect(() => {
    if (!opsAccess && (activeTab === 'history' || activeTab === 'logs')) {
      setActiveTab('overview');
    }
  }, [activeTab, opsAccess]);
  const [form, setForm] = useState<UpsertErpSyncSettingsInput>({
    syncStock: true,
    syncProducts: true,
    syncInvoices: false,
    syncPrices: true,
    syncOrders: false,
    syncCustomers: false,
    autoInvoiceOnDelivered: false,
    productImportMode: 'ECOMMERCE_ONLY',
    erpCategoryIds: [],
  });

  const upsertRunning = useSyncMonitorStore((s) => s.upsertRunning);
  const markError = useSyncMonitorStore((s) => s.markError);
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
  const platformLabel = branding?.label ?? 'ERP bağlantısı';
  const pageTitle = branding ? `${branding.label} — ERP` : 'ERP bağlantısı';
  const navContextLine = useMemo(
    () => formatNavPageContext(t(NAV_GROUP_LABEL_KEYS.externalErp), platformLabel),
    [t, platformLabel],
  );

  const blockedByNativeMode = !accountingModeLoading && !externalErpUi;
  const effectivePageTitle = blockedByNativeMode ? t('nav.connections') : pageTitle;
  const effectiveBreadcrumb = blockedByNativeMode ? t('nav.connections') : platformLabel;

  usePageTitle(effectivePageTitle);
  useBreadcrumbTail(effectiveBreadcrumb);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsToForm(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (
      initialTab === 'settings' ||
      initialTab === 'history' ||
      initialTab === 'logs'
    ) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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
        const normalized = normalizeErpTestConnectionResult(res);
        if (normalized.connected) {
          const withLabel: ErpTestConnectionResult = {
            ...normalized,
            companyName:
              normalized.companyName ?? connection?.accountLabel ?? undefined,
          };
          setTestResult({
            ok: true,
            message: formatErpTestSuccessMessage(withLabel),
          });
        } else {
          setTestResult({
            ok: false,
            message: formatConnectionTestFailureMessage(normalized.message),
          });
        }
      },
      onError: (error) => {
        const msg = getApiErrorMessage(error);
        setTestResult({
          ok: false,
          message: formatConnectionTestFailureMessage(msg),
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
        const message = getApiErrorMessage(error);
        markError(connectionId, message);
        toast.error(message);
      },
    });
  };

  if (connectionsQuery.isLoading || settingsQuery.isLoading || accountingModeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!externalErpUi) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/connections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('connections.erpDetail.backToConnections')}
          </Link>
        </Button>
        <ErpBridgeSection variant="nativeNotice" />
      </div>
    );
  }

  if (connectionsQuery.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{getApiErrorMessage(connectionsQuery.error)}</p>
        </CardContent>
      </Card>
    );
  }

  if (!connection) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-muted-foreground">ERP bağlantısı bulunamadı.</p>
          <Button variant="outline" asChild>
            <Link to="/connections">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Bağlantılara dön
            </Link>
          </Button>
        </CardContent>
      </Card>
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
    <div className="space-y-6">
      <PageHeader
        title={erpConnectionDisplayName(connection)}
        description={`${branding?.label ?? connection.erpType} · ${branding?.accountFieldLabel ?? 'Hesap'}: ${connection.accountLabel ?? '—'}`}
        context={navContextLine}
        badges={
          <>
            <Badge
              variant="outline"
              className={
                connection.role === 'PRIMARY'
                  ? 'border-sky-200 bg-sky-50 font-medium text-sky-900'
                  : 'border-violet-200 bg-violet-50 font-medium text-violet-900'
              }
            >
              {erpConnectionRoleLabel(connection.role)}
            </Badge>
            <Badge
              variant="outline"
              className="border-violet-200 bg-violet-50 font-medium text-violet-900"
            >
              Harici ERP bağlantısı
            </Badge>
            {health ? (
              <Badge variant="outline" className={statusBadgeClass(health.status)}>
                {opsAccess
                  ? statusLabel(health.status)
                  : customerConnectionStatusLabel(health.status)}
              </Badge>
            ) : null}
            {!accountingModeLoading && accountingMode ? (
              <AccountingModeBadge mode={accountingMode} />
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/connections">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Bağlantılara dön
              </Link>
            </Button>
            {connection.role === 'SECONDARY' ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={setPrimary.isPending}
                onClick={() => {
                  setPrimary.mutate(connection.id, {
                    onSuccess: () => {
                      toast.success('Birincil ERP bağlantısı güncellendi.');
                    },
                    onError: (error) => {
                      toast.error(getApiErrorMessage(error));
                    },
                  });
                }}
              >
                Birincil ERP yap
              </Button>
            ) : null}
            {opsAccess ? (
              <>
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
              </>
            ) : null}
          </div>
        }
      />

      {opsAccess && (syncNow.isPending || activeMonitor) && (
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

      {connection ? (
        <ConnectionProductMatchKeyCard
          value={connection.productMatchKey}
          disabled={updateErpConnection.isPending}
          onSave={async (productMatchKey) => {
            if (!connectionId) {
              return;
            }
            await updateErpConnection.mutateAsync({ id: connectionId, productMatchKey });
          }}
        />
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-lg border border-border/80 bg-muted/40 p-1.5 shadow-sm">
          <TabsTrigger
            value="overview"
            className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-emerald-500/25"
          >
            Genel Bakış
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-emerald-500/25"
          >
            Sync Ayarları
          </TabsTrigger>
          {opsAccess ? (
            <>
              <TabsTrigger
                value="history"
                className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-emerald-500/25"
              >
                Sync Geçmişi
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-emerald-500/25"
              >
                Log
              </TabsTrigger>
            </>
          ) : null}
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
                    {opsAccess
                      ? testResult
                        ? testResult.ok
                          ? testResult.message
                          : 'Başarısız'
                        : connection.isActive
                          ? 'Henüz test edilmedi'
                          : 'Pasif'
                      : connection.isActive
                        ? 'Otomatik doğrulanır'
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
                      {opsAccess
                        ? statusLabel(health.status)
                        : customerConnectionStatusLabel(health.status)}
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
                {opsAccess ? (
                  connection.erpType === 'BIZIMHESAP' ? (
                    <p className="text-sm text-muted-foreground">
                      BizimHesap API kotası (saatte ~10 istek) nedeniyle canlı bağlantı testi
                      yapılmaz. Token kaydedildiğinde bağlantı aktif sayılır; ilk doğrulama
                      planlı veya manuel ürün senkronu ile olur.
                    </p>
                  ) : (
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
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Senkronizasyon otomatik olarak yapılır; ek bir işlem gerekmez.
                  </p>
                )}
              </div>
              {opsAccess && testResult && connection.erpType !== 'BIZIMHESAP' ? (
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
            {opsAccess ? (
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
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Entegrasyon durumu</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {health ? (
                    <Badge variant="outline" className={statusBadgeClass(health.status)}>
                      {customerConnectionStatusLabel(health.status)}
                    </Badge>
                  ) : (
                    <Skeleton className="h-6 w-24" />
                  )}
                  {(health?.status === 'error' || health?.status === 'warning') && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                      Entegrasyonunuz kontrol ediliyor. Sorun devam ederse destek talebi
                      oluşturabilirsiniz.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{opsAccess ? 'Son sync özeti' : 'Son senkron'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">
                    {opsAccess ? 'Son başarılı' : 'Son güncelleme'}
                  </p>
                  <p className="font-medium">
                    {lastSuccessLog
                      ? `${opsAccess ? `${erpJobLabel(lastSuccessLog.jobType)} · ` : ''}${format(
                          new Date(lastSuccessLog.startedAt),
                          'd MMM yyyy HH:mm',
                          { locale: tr },
                        )}${opsAccess ? ` · ${lastSuccessLog.itemsProcessed} kayıt` : ''}`
                      : lastSyncLabel}
                  </p>
                </div>
                {opsAccess ? (
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
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Senkron ayarları</CardTitle>
              <CardDescription>
                Hangi verilerin senkronize edileceğini seçin. Sıklık platform tarafından
                otomatik yönetilir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {connection.role === 'SECONDARY' ? (
                <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
                  {erpConnectionRoleHint('SECONDARY')}
                </p>
              ) : null}
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Senkronizasyon sıklığı</p>
                <p className="mt-1 text-muted-foreground">
                  {erpSyncScheduleLabel(connection.erpType)} — müşteri tarafından
                  değiştirilemez.
                </p>
                {settingsQuery.data?.nextSyncAt ? (
                  <p className="mt-2 text-muted-foreground">
                    Sonraki planlı senkron:{' '}
                    {format(new Date(settingsQuery.data.nextSyncAt), 'd MMM yyyy HH:mm', {
                      locale: tr,
                    })}
                  </p>
                ) : null}
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
                ].map((item) => {
                  const writeDisabled =
                    connection.role === 'SECONDARY' &&
                    (item.key === 'syncOrders' || item.key === 'syncPrices');
                  return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {writeDisabled
                          ? 'İkincil ERP — yalnızca okuma'
                          : item.desc}
                      </p>
                    </div>
                    <Switch
                      checked={form[item.key] ?? false}
                      disabled={writeDisabled}
                      onCheckedChange={(v) => {
                        setForm((f) => ({ ...f, [item.key]: v }));
                      }}
                      aria-label={item.title}
                    />
                  </div>
                  );
                })}
              </div>

              {form.syncProducts ? (
                <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
                  <div>
                    <p className="font-medium">Ürün içe aktarma kapsamı</p>
                    <p className="text-xs text-muted-foreground">
                      BizimHesap&apos;tan hangi ürünlerin Senkronize&apos;ye alınacağını belirler.
                      Tüm stok kartları değil, yalnızca seçtiğiniz kapsam senkronize edilir.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-import-mode">Filtre modu</Label>
                    <Select
                      value={normalizeProductImportMode(form.productImportMode)}
                      onValueChange={(value) => {
                        const mode = normalizeProductImportMode(value);
                        setForm((f) => ({
                          ...f,
                          productImportMode: mode,
                          ...(mode !== 'CATEGORY' ? { erpCategoryIds: [] } : {}),
                        }));
                      }}
                    >
                      <SelectTrigger id="product-import-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ECOMMERCE_ONLY">
                          E-ticaret ürünleri (isEcommerce)
                        </SelectItem>
                        <SelectItem value="CATEGORY">Kategori filtresi</SelectItem>
                        <SelectItem value="ALL">Tüm ürünler</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.productImportMode === 'CATEGORY' ? (
                    <div className="space-y-2">
                      <Label htmlFor="erp-category-ids">BizimHesap kategori ID veya adları</Label>
                      <Input
                        id="erp-category-ids"
                        placeholder="Örn: E-Ticaret, Elektrik, 12"
                        value={(form.erpCategoryIds ?? []).join(', ')}
                        onChange={(event) => {
                          const ids = event.target.value
                            .split(',')
                            .map((part) => part.trim())
                            .filter(Boolean);
                          setForm((f) => ({ ...f, erpCategoryIds: ids }));
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Virgülle ayırın. BizimHesap&apos;taki kategori adı veya ID ile eşleşir
                        (E-Ticaret / E-TİCARET gibi yazım farkları otomatik normalize edilir).
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
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
                <ul className="divide-y rounded-lg border bg-card shadow-sm">
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
