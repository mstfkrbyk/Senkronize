import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plug,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ConnectionFormModal,
  type ConnectionFormModalConfig,
} from '@/components/ConnectionFormModal';
import { SyncMonitorPanel } from '@/components/connections/SyncMonitorPanel';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMarketplaceConnections } from '@/hooks/useConnections';
import { useErpConnections, type ErpConnectionDto } from '@/hooks/useErpConnections';
import { fromApiSyncFrequency, type ErpSyncSettingsDto } from '@/hooks/useErpSyncSettings';
import { api, getApiErrorMessage } from '@/lib/api';
import type { SyncLogEntry } from '@/types/sync-log';
import type { MarketplaceConnectionDto } from '@/types/connection';

import {
  computeConnectionKpis,
  erpSyncFrequencyLabel,
  erpToRow,
  marketplaceToRow,
  type UnifiedConnectionRow,
} from './connection-utils';
import { ConnectionsTable } from './ConnectionsTable';
import { ErpSetupWizard } from './ErpSetupWizard';

interface KpiCardProps {
  title: string;
  value: string;
  icon: typeof CheckCircle2;
  tone: string;
  loading: boolean;
}

function KpiCard({ title, value, icon: Icon, tone, loading }: KpiCardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${tone}`} aria-hidden />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function filterRows(
  rows: UnifiedConnectionRow[],
  tab: 'all' | 'marketplace' | 'ecommerce' | 'erp' | 'cargo',
): UnifiedConnectionRow[] {
  if (tab === 'all') {
    return rows;
  }
  if (tab === 'erp') {
    return rows.filter((r) => r.kind === 'erp');
  }
  if (tab === 'cargo') {
    return rows.filter((r) => r.kind === 'cargo');
  }
  if (tab === 'ecommerce') {
    return rows.filter((r) => r.kind === 'ecommerce');
  }
  return rows.filter((r) => r.kind === 'marketplace');
}

function aggregateErpDocuments(
  connectionId: string,
  logs: SyncLogEntry[],
): string {
  let invoices = 0;
  let stockMoves = 0;
  for (const log of logs) {
    if (!log.jobType.startsWith(`erp:${connectionId}:`)) {
      continue;
    }
    if (log.status !== 'SUCCESS' && log.status !== 'PARTIAL') {
      continue;
    }
    const type = log.jobType.split(':')[2];
    if (type === 'invoices') {
      invoices += log.itemsProcessed;
    }
    if (type === 'stock') {
      stockMoves += log.itemsProcessed;
    }
  }
  if (invoices === 0 && stockMoves === 0) {
    return '—';
  }
  return `${invoices} fatura / ${stockMoves} stok hareketi`;
}

export function ConnectionsPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<
    'all' | 'marketplace' | 'ecommerce' | 'erp' | 'cargo'
  >('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<ConnectionFormModalConfig | null>(null);
  const [erpWizardOpen, setErpWizardOpen] = useState(false);

  const {
    data: connections,
    isLoading: mpLoading,
    isError: mpError,
    error: mpErr,
    refetch: refetchMp,
  } = useMarketplaceConnections();

  const {
    data: erpConnections,
    isLoading: erpLoading,
    isError: erpIsError,
    error: erpErr,
    refetch: refetchErp,
  } = useErpConnections();

  const erpSettingsQueries = useQueries({
    queries: (erpConnections ?? []).map((c) => ({
      queryKey: ['erp-sync-settings', c.id],
      queryFn: async (): Promise<ErpSyncSettingsDto> => {
        const { data } = await api.get<{ data: ErpSyncSettingsDto }>(
          `/erp-connections/${c.id}/sync-settings`,
        );
        return {
          ...data.data,
          syncFrequency: fromApiSyncFrequency(data.data.syncFrequency),
        };
      },
    })),
  });

  const erpLogsQuery = useQueries({
    queries: (erpConnections ?? []).map((c) => ({
      queryKey: ['erp-sync-logs', c.id, 'summary'],
      queryFn: async (): Promise<SyncLogEntry[]> => {
        const params = new URLSearchParams({
          jobTypeStartsWith: `erp:${c.id}:`,
          limit: '30',
        });
        const { data } = await api.get<{ data: SyncLogEntry[] }>(
          `/sync/logs?${params.toString()}`,
        );
        return data.data;
      },
    })),
  });

  const erpSettingsById = useMemo(() => {
    const map = new Map<string, ErpSyncSettingsDto>();
    for (const q of erpSettingsQueries) {
      if (q.data) {
        map.set(q.data.erpConnectionId, q.data);
      }
    }
    return map;
  }, [erpSettingsQueries]);

  const erpLogsById = useMemo(() => {
    const map = new Map<string, SyncLogEntry[]>();
    (erpConnections ?? []).forEach((c, index) => {
      const logs = erpLogsQuery[index]?.data ?? [];
      map.set(c.id, logs);
    });
    return map;
  }, [erpConnections, erpLogsQuery]);

  const allRows = useMemo((): UnifiedConnectionRow[] => {
    const mpRows = (connections ?? []).map((c) => marketplaceToRow(c));
    const erpRows = (erpConnections ?? []).map((c) => {
      const settings = erpSettingsById.get(c.id);
      const freqLabel = settings
        ? erpSyncFrequencyLabel(settings.syncFrequency)
        : '—';
      const docsLabel = aggregateErpDocuments(c.id, erpLogsById.get(c.id) ?? []);
      return erpToRow(c, freqLabel, docsLabel);
    });
    return [...mpRows, ...erpRows];
  }, [connections, erpConnections, erpSettingsById, erpLogsById]);

  const visibleRows = useMemo(
    () => filterRows(allRows, mainTab),
    [allRows, mainTab],
  );

  const kpis = useMemo(() => computeConnectionKpis(allRows), [allRows]);
  const loading = mpLoading || erpLoading;
  const hasError = mpError || erpIsError;

  const openAddModal = (): void => {
    if (mainTab === 'erp') {
      setModalConfig({ kind: 'erp', mode: 'create' });
    } else if (mainTab === 'ecommerce') {
      setModalConfig({
        kind: 'marketplace',
        mode: 'create',
        listFilter: 'ecommerce',
      });
    } else {
      setModalConfig({
        kind: 'marketplace',
        mode: 'create',
        listFilter: 'marketplace',
      });
    }
    setModalOpen(true);
  };

  const openEditMarketplace = (c: MarketplaceConnectionDto): void => {
    setModalConfig({ kind: 'marketplace', mode: 'edit', connection: c });
    setModalOpen(true);
  };

  const openEditErp = (c: ErpConnectionDto): void => {
    setModalConfig({ kind: 'erp', mode: 'edit', connection: c });
    setModalOpen(true);
  };

  const handleModalOpenChange = (next: boolean): void => {
    setModalOpen(next);
    if (!next) {
      setModalConfig(null);
    }
  };

  const isEmpty = !loading && !hasError && allRows.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            {t('connections.title')}
          </h1>
          <p className="text-muted-foreground">{t('connections.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mainTab === 'erp' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/connections/erp/setup')}
            >
              ERP Kurulum Sihirbazı
            </Button>
          ) : null}
          <Button type="button" onClick={() => openAddModal()}>
            {t('connections.add')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Aktif"
          value={String(kpis.active)}
          icon={CheckCircle2}
          tone="text-green-600"
          loading={loading}
        />
        <KpiCard
          title="Hata"
          value={String(kpis.error)}
          icon={XCircle}
          tone="text-red-600"
          loading={loading}
        />
        <KpiCard
          title="Bekleyen"
          value={String(kpis.pending)}
          icon={AlertTriangle}
          tone="text-amber-600"
          loading={loading}
        />
        <KpiCard
          title="Toplam"
          value={String(kpis.total)}
          icon={Clock}
          tone="text-sky-600"
          loading={loading}
        />
      </div>

      <SyncMonitorPanel />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {hasError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">
            {getApiErrorMessage(mpErr ?? erpErr)}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => {
              void refetchMp();
              void refetchErp();
            }}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={Plug}
          title={t('connections.emptyMarketplaceTitle')}
          description={t('connections.emptyMarketplaceDescription')}
          action={{
            label: t('connections.emptyMarketplaceAction'),
            onClick: () => {
              setModalConfig({
                kind: 'marketplace',
                mode: 'create',
                listFilter: 'marketplace',
              });
              setModalOpen(true);
            },
          }}
        />
      ) : null}

      {!loading && !hasError && allRows.length > 0 ? (
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="all">Tümü</TabsTrigger>
            <TabsTrigger value="marketplace">{t('connections.marketplace')}</TabsTrigger>
            <TabsTrigger value="ecommerce">{t('connections.ecommerce')}</TabsTrigger>
            <TabsTrigger value="erp">{t('connections.erp')}</TabsTrigger>
            <TabsTrigger value="cargo">{t('connections.cargo')}</TabsTrigger>
          </TabsList>

          <TabsContent value={mainTab} className="mt-6">
            <ConnectionsTable
              rows={visibleRows}
              marketplaceConnections={connections ?? []}
              erpConnections={erpConnections ?? []}
              onEditMarketplace={openEditMarketplace}
              onEditErp={openEditErp}
              variant={mainTab === 'erp' ? 'erp' : 'default'}
            />
          </TabsContent>
        </Tabs>
      ) : null}

      <ConnectionFormModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        config={modalConfig}
      />

      <ErpSetupWizard
        open={erpWizardOpen}
        onOpenChange={setErpWizardOpen}
        onCompleted={() => {
          void refetchErp();
        }}
      />
    </div>
  );
}
