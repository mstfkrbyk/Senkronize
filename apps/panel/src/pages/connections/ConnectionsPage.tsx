import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plug,
  Plus,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  ConnectionFormModal,
  type ConnectionFormModalConfig,
} from '@/components/ConnectionFormModal';
import { SyncMonitorPanel } from '@/components/connections/SyncMonitorPanel';
import { EmptyState } from '@/components/EmptyState';
import { AccountingModeBadge } from '@/components/AccountingModeBadge';
import { IntegrationConnectionsEmptyState } from '@/components/IntegrationConnectionsEmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useIntegrationOpsAccess } from '@/hooks/useIntegrationOpsAccess';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useErpConnections, type ErpConnectionDto } from '@/hooks/useErpConnections';
import { fromApiSyncFrequency, type ErpSyncSettingsDto } from '@/hooks/useErpSyncSettings';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
import { api, getApiErrorMessage } from '@/lib/api';
import { erpSlotUsageLabel, isErpSlotQuotaFull } from '@/lib/erp-slot-usage';
import type { SyncLogEntry } from '@/types/sync-log';
import type { MarketplaceConnectionDto } from '@/types/connection';

import {
  computeConnectionKpis,
  erpSyncScheduleLabel,
  erpToRow,
  marketplaceToRow,
  type UnifiedConnectionRow,
} from './connection-utils';
import {
  resolveConnectionsProductAccess,
  showExternalErpBridgeUi,
} from './connections-product-access';
import {
  defaultConnectionTab,
  isConnectionTabId,
  resolveConnectionChannelTabs,
  resolveConnectionErpTab,
  resolveConnectionsSubtitleKey,
  type ConnectionTabId,
} from './connections-tabs.config';
import { resolveConnectionsNavGroupId } from './connections-nav-context';
import { ConnectionsChannelPanel } from './ConnectionsChannelPanel';
import { ConnectionsTable } from './ConnectionsTable';
import { ConnectionsBundleNativeGuide } from './ConnectionsBundleNativeGuide';
import { ErpBridgeSection } from './ErpBridgeSection';
import { ErpSetupWizard } from './ErpSetupWizard';
import { IntegrationProductPrompt } from './IntegrationProductPrompt';
import { useConnectionsPageMarketplace } from './useConnectionsPageQueries';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { NAV_GROUP_LABEL_KEYS } from '@/lib/nav-match';
import { isBundleOrg } from '@/lib/org-products';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const CONNECTION_TAB_TRIGGER_CLASS =
  'rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-sky-500/25';

const CONNECTION_ERP_TAB_ACTIVE_CLASS =
  'data-[state=active]:ring-sky-500/30';

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
  tab: ConnectionTabId,
): UnifiedConnectionRow[] {
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
  const [searchParams, setSearchParams] = useSearchParams();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode, isLoading: accountingModeLoading } =
    useAccountingMode();
  const opsAccess = useIntegrationOpsAccess();
  const productAccess = useMemo(
    () => resolveConnectionsProductAccess(orgProducts),
    [orgProducts],
  );
  const channelTabs = useMemo(
    () => resolveConnectionChannelTabs(productAccess),
    [productAccess],
  );
  const erpTab = useMemo(
    () => resolveConnectionErpTab(productAccess, accountingMode),
    [productAccess, accountingMode],
  );
  const defaultTab = useMemo(
    () => defaultConnectionTab(productAccess),
    [productAccess],
  );
  const subtitleKey = useMemo(
    () => resolveConnectionsSubtitleKey(productAccess, accountingMode),
    [productAccess, accountingMode],
  );
  const externalErpUi = useMemo(
    () => showExternalErpBridgeUi(productAccess, accountingMode),
    [productAccess, accountingMode],
  );
  const isNativeAccounting = accountingMode === 'NATIVE';
  const showBundleNativeGuide =
    !accountingModeLoading &&
    isNativeAccounting &&
    isBundleOrg(orgProducts) &&
    productAccess.showIntegrationTabs;
  const showNativeAccountingNotice =
    !accountingModeLoading &&
    isNativeAccounting &&
    productAccess.accountingOnly;
  const [mainTab, setMainTab] = useState<ConnectionTabId>(defaultTab);
  const urlTab = searchParams.get('tab');
  const navGroupId = useMemo(
    () =>
      resolveConnectionsNavGroupId(
        productAccess,
        accountingMode,
        mainTab,
        urlTab,
      ),
    [productAccess, accountingMode, mainTab, urlTab],
  );
  const navContextLine = formatNavPageContext(
    t(NAV_GROUP_LABEL_KEYS[navGroupId]),
    t('nav.connections'),
  );
  usePageTitle(t('nav.connections'));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<ConnectionFormModalConfig | null>(null);
  const [erpWizardOpen, setErpWizardOpen] = useState(false);

  useEffect(() => {
    const urlTabParam = searchParams.get('tab');
    if (urlTabParam === 'erp' && erpTab) {
      setMainTab('erp');
      return;
    }
    if (
      urlTabParam &&
      channelTabs.some((item) => item.id === urlTabParam)
    ) {
      setMainTab(urlTabParam as ConnectionTabId);
      return;
    }
    if (urlTabParam === 'erp' && !erpTab && searchParams.has('tab')) {
      setSearchParams({}, { replace: true });
    }
  }, [erpTab, channelTabs, searchParams, setSearchParams]);

  useEffect(() => {
    if (!isConnectionTabId(mainTab, channelTabs, erpTab)) {
      setMainTab(defaultTab);
    }
  }, [mainTab, channelTabs, erpTab, defaultTab]);

  const handleMainTabChange = (value: ConnectionTabId): void => {
    setMainTab(value);
    if (value === 'erp') {
      setSearchParams({ tab: 'erp' }, { replace: true });
      return;
    }
    if (channelTabs.some((item) => item.id === value)) {
      setSearchParams({ tab: value }, { replace: true });
    }
  };

  const {
    data: connections,
    isLoading: mpLoading,
    isError: mpError,
    error: mpErr,
    refetch: refetchMp,
  } = useConnectionsPageMarketplace(productAccess.showIntegrationTabs);

  const {
    data: erpConnections,
    isLoading: erpLoading,
    isError: erpIsError,
    error: erpErr,
    refetch: refetchErp,
  } = useErpConnections();

  const usageQuery = useSubscriptionUsage(externalErpUi);
  const erpSlotFull = isErpSlotQuotaFull(usageQuery.data);

  const erpQueriesEnabled = externalErpUi;

  const erpSettingsQueries = useQueries({
    queries: erpQueriesEnabled
      ? (erpConnections ?? []).map((c) => ({
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
    }))
      : [],
  });

  const erpLogsQuery = useQueries({
    queries: erpQueriesEnabled
      ? (erpConnections ?? []).map((c) => ({
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
    }))
      : [],
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
    const mpRows = productAccess.showIntegrationTabs
      ? (connections ?? []).map((c) => marketplaceToRow(c))
      : [];
    const erpRows = externalErpUi
      ? (erpConnections ?? []).map((c) => {
          const settings = erpSettingsById.get(c.id);
          const freqLabel = erpSyncScheduleLabel(c.erpType);
          const docsLabel = aggregateErpDocuments(c.id, erpLogsById.get(c.id) ?? []);
          return erpToRow(c, freqLabel, docsLabel);
        })
      : [];
    return [...mpRows, ...erpRows];
  }, [
    connections,
    erpConnections,
    erpSettingsById,
    erpLogsById,
    productAccess.showIntegrationTabs,
    externalErpUi,
  ]);

  const kpis = useMemo(() => computeConnectionKpis(allRows), [allRows]);
  const loading =
    (productAccess.showIntegrationTabs && mpLoading) ||
    (externalErpUi && erpLoading);
  const hasError =
    (productAccess.showIntegrationTabs && mpError) ||
    (externalErpUi && erpIsError);
  const erpRowsOnly = useMemo(
    () => allRows.filter((r) => r.kind === 'erp'),
    [allRows],
  );
  const showErpSection =
    externalErpUi && (productAccess.accountingOnly || mainTab === 'erp');

  const openAddModal = (): void => {
    if (mainTab === 'erp') {
      if (erpSlotFull) {
        toast.error(
          `ERP bağlantı kotası dolu (${erpSlotUsageLabel(usageQuery.data)}). Ek slot için abonelik veya yönetici tanımı gerekir.`,
        );
        return;
      }
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
  const isErpEmpty =
    !loading &&
    !hasError &&
    externalErpUi &&
    erpRowsOnly.length === 0;
  const showErpModeDot =
    externalErpUi && accountingMode === 'EXTERNAL_ERP' && !accountingModeLoading;
  const canAddConnection =
    (productAccess.showIntegrationTabs && mainTab !== 'erp') ||
    (productAccess.accountingOnly && externalErpUi);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('connections.title')}
        description={t(subtitleKey)}
        context={navContextLine}
        badges={
          !accountingModeLoading && accountingMode ? (
            <AccountingModeBadge mode={accountingMode} />
          ) : null
        }
        actions={
          <>
            {showErpSection ? (
              <Button
                type="button"
                variant="outline"
                disabled={erpSlotFull}
                title={
                  erpSlotFull
                    ? `ERP kotası dolu (${erpSlotUsageLabel(usageQuery.data)})`
                    : undefined
                }
                onClick={() => {
                  if (erpSlotFull) {
                    toast.error(
                      `ERP bağlantı kotası dolu (${erpSlotUsageLabel(usageQuery.data)}).`,
                    );
                    return;
                  }
                  navigate('/connections/erp/setup');
                }}
              >
                {t('connections.erpBridge.wizardButton')}
              </Button>
            ) : null}
            {canAddConnection ? (
              <Button
                type="button"
                size="default"
                disabled={
                  (mainTab === 'erp' || productAccess.accountingOnly) && erpSlotFull
                }
                title={
                  (mainTab === 'erp' || productAccess.accountingOnly) && erpSlotFull
                    ? `ERP kotası dolu (${erpSlotUsageLabel(usageQuery.data)})`
                    : undefined
                }
                onClick={() => openAddModal()}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                {productAccess.accountingOnly || mainTab === 'erp'
                  ? t('connections.erpBridge.addConnection')
                  : t('connections.add')}
              </Button>
            ) : null}
          </>
        }
      />

      {productAccess.accountingOnly ? (
        <IntegrationProductPrompt showNativeAccountingCta={isNativeAccounting} />
      ) : null}

      {showBundleNativeGuide ? <ConnectionsBundleNativeGuide /> : null}

      {showNativeAccountingNotice ? (
        <ErpBridgeSection variant="nativeNotice" />
      ) : null}

      {productAccess.showIntegrationTabs ? (
      <div className={`grid gap-4 ${opsAccess ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}`}>
        <KpiCard
          title={t('connections.kpi.active')}
          value={String(kpis.active)}
          icon={CheckCircle2}
          tone="text-green-600"
          loading={loading}
        />
        {opsAccess ? (
          <>
            <KpiCard
              title={t('connections.kpi.error')}
              value={String(kpis.error)}
              icon={XCircle}
              tone="text-red-600"
              loading={loading}
            />
            <KpiCard
              title={t('connections.kpi.pending')}
              value={String(kpis.pending)}
              icon={AlertTriangle}
              tone="text-amber-600"
              loading={loading}
            />
          </>
        ) : null}
        <KpiCard
          title={t('connections.kpi.total')}
          value={String(kpis.total)}
          icon={Clock}
          tone="text-sky-600"
          loading={loading}
        />
      </div>
      ) : null}

      {productAccess.showIntegrationTabs ? <SyncMonitorPanel /> : null}

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
              if (productAccess.showIntegrationTabs) {
                void refetchMp();
              }
              if (externalErpUi) {
                void refetchErp();
              }
            }}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {isEmpty && productAccess.showIntegrationTabs && !productAccess.accountingOnly ? (
        <IntegrationConnectionsEmptyState
          onAddMarketplace={() => {
            setModalConfig({
              kind: 'marketplace',
              mode: 'create',
              listFilter: 'marketplace',
            });
            setModalOpen(true);
          }}
          onAddEcommerce={() => {
            setModalConfig({
              kind: 'marketplace',
              mode: 'create',
              listFilter: 'ecommerce',
            });
            setModalOpen(true);
          }}
        />
      ) : null}

      {isErpEmpty && showErpSection ? (
        <ErpBridgeSection variant="externalBridge">
          <EmptyState
            icon={Plug}
            title={t('connections.emptyErpTitle')}
            description={t('connections.emptyErpDescription')}
            actionSlot={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={erpSlotFull}
                  onClick={() => {
                    if (erpSlotFull) {
                      toast.error(
                        `ERP bağlantı kotası dolu (${erpSlotUsageLabel(usageQuery.data)}).`,
                      );
                      return;
                    }
                    setModalConfig({ kind: 'erp', mode: 'create' });
                    setModalOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  {t('connections.emptyErpAction')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={erpSlotFull}
                  onClick={() => {
                    if (erpSlotFull) {
                      toast.error(
                        `ERP bağlantı kotası dolu (${erpSlotUsageLabel(usageQuery.data)}).`,
                      );
                      return;
                    }
                    navigate('/connections/erp/setup');
                  }}
                >
                  {t('connections.erpBridge.wizardButton')}
                </Button>
              </div>
            }
          />
        </ErpBridgeSection>
      ) : null}

      {productAccess.accountingOnly &&
      externalErpUi &&
      !loading &&
      !hasError &&
      erpRowsOnly.length > 0 ? (
        <ErpBridgeSection variant="externalBridge">
          <ConnectionsTable
            rows={erpRowsOnly}
            marketplaceConnections={[]}
            erpConnections={erpConnections ?? []}
            onEditMarketplace={openEditMarketplace}
            onEditErp={openEditErp}
            variant="erp"
          />
        </ErpBridgeSection>
      ) : null}

      {!loading && !hasError && productAccess.showIntegrationTabs ? (
        <Tabs
          value={mainTab}
          onValueChange={(v) => {
            if (isConnectionTabId(v, channelTabs, erpTab)) {
              handleMainTabChange(v);
            }
          }}
        >
          <TabsList
            className="flex h-auto w-full max-w-full flex-wrap items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-1.5 shadow-sm"
            aria-label={t('connections.title')}
          >
            <span className="sr-only">{t('connections.tabs.groupChannels')}</span>
            {channelTabs.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className={CONNECTION_TAB_TRIGGER_CLASS}
              >
                {t(item.labelKey)}
              </TabsTrigger>
            ))}
            {erpTab ? (
              <>
                <span
                  className="mx-1 hidden h-6 w-px shrink-0 bg-border sm:inline-block"
                  aria-hidden
                />
                <span className="sr-only">
                  {t('connections.tabs.groupExternalErp')}
                </span>
                <TabsTrigger
                  value={erpTab.id}
                  className={cn(
                    CONNECTION_TAB_TRIGGER_CLASS,
                    CONNECTION_ERP_TAB_ACTIVE_CLASS,
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    {t(erpTab.labelKey)}
                    {showErpModeDot ? (
                      <Badge
                        variant="outline"
                        className="hidden border-sky-300 bg-sky-50 px-1.5 py-0 text-[10px] font-normal text-sky-700 sm:inline-flex"
                      >
                        {t('connections.tabs.externalErpHint')}
                      </Badge>
                    ) : null}
                  </span>
                </TabsTrigger>
              </>
            ) : null}
          </TabsList>

          {channelTabs.map((item) => (
            <TabsContent key={item.id} value={item.id} className="mt-6">
              <ConnectionsChannelPanel
                rows={filterRows(allRows, item.id)}
                marketplaceConnections={connections ?? []}
                erpConnections={erpConnections ?? []}
                onEditMarketplace={openEditMarketplace}
                onEditErp={openEditErp}
                groupByRegion={item.id === 'marketplace'}
              />
            </TabsContent>
          ))}
          {erpTab && externalErpUi ? (
            <TabsContent value="erp" className="mt-6">
              <ErpBridgeSection variant="externalBridge">
                <ConnectionsTable
                  rows={filterRows(allRows, 'erp')}
                  marketplaceConnections={connections ?? []}
                  erpConnections={erpConnections ?? []}
                  onEditMarketplace={openEditMarketplace}
                  onEditErp={openEditErp}
                  variant="erp"
                />
              </ErpBridgeSection>
            </TabsContent>
          ) : null}
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
