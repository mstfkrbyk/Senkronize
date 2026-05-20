import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { OrderBulkActions } from '@/components/orders/OrderBulkActions';
import { AdvancedFilters } from '@/components/AdvancedFilters';
import { DataTablePagination } from '@/components/DataTablePagination';
import { TablePageEmptyState } from '@/components/TablePageEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useMarketplaceConnections, useTriggerManualSync } from '@/hooks/useConnections';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { api, getApiErrorMessage } from '@/lib/api';
import { useOrdersPageStore } from '@/store/tablePages.store';
import type { Order, OrderFilters as OrderFiltersState } from '@/types/order';
import { ShipOrderModal } from '@/components/orders/ShipOrderModal';

import { OrdersKpiRow } from './OrdersKpiRow';
import {
  ORDER_DATE_PRESET_LABELS,
  resolveOrderDatePreset,
  type OrderDatePreset,
} from './orderDatePresets';
import {
  buildOrderFilterConfig,
  ORDER_FILTER_DEFAULTS,
  ORDER_PAGE_SIZE,
} from './orderFilters.config';
import { OrdersTable } from './OrdersTable';
import { useOrders, useOrderSummary } from './hooks/useOrders';

const PAGE_SIZE_DEFAULT = ORDER_PAGE_SIZE;

function urlFiltersToOrderFilters(
  url: typeof ORDER_FILTER_DEFAULTS,
): OrderFiltersState {
  const platforms = url.platforms.length > 0 ? url.platforms.join(',') : undefined;
  const statuses = url.statuses.length > 0 ? url.statuses.join(',') : undefined;
  return {
    page: url.page,
    limit: url.limit,
    platforms,
    statuses,
    startDate: url.startDate.trim() || undefined,
    endDate: url.endDate.trim() || undefined,
    search: url.search.trim() || undefined,
    cargoProvider: url.cargoProvider.trim() || undefined,
    minTotal: url.minTotal,
    maxTotal: url.maxTotal,
  };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function OrdersPageSkeleton(): ReactElement {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-md" />
      ))}
    </div>
  );
}

export function OrdersPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageTitle(t('orders.title'));
  const orderFilterConfig = useMemo(() => buildOrderFilterConfig(t), [t]);
  const queryClient = useQueryClient();
  const [urlFilters, setUrlFilters, resetUrlFilters] = useUrlFilters(
    ORDER_FILTER_DEFAULTS,
  );
  const filters = useMemo(
    () => urlFiltersToOrderFilters(urlFilters),
    [urlFilters],
  );

  const [datePreset, setDatePreset] = useState<OrderDatePreset>('custom');

  const applyDatePreset = useCallback(
    (preset: OrderDatePreset): void => {
      setDatePreset(preset);
      if (preset === 'custom') {
        return;
      }
      const range = resolveOrderDatePreset(preset);
      if (range) {
        setUrlFilters({
          startDate: range.startDate,
          endDate: range.endDate,
          page: 1,
        });
      }
    },
    [setUrlFilters],
  );

  useEffect(() => {
    if (!urlFilters.startDate && !urlFilters.endDate) {
      setDatePreset('custom');
    }
  }, [urlFilters.startDate, urlFilters.endDate]);

  const handleFilterChange = useCallback(
    (values: Record<string, unknown>): void => {
      setDatePreset('custom');
      setUrlFilters({
        ...(values as typeof ORDER_FILTER_DEFAULTS),
        page: 1,
      });
    },
    [setUrlFilters],
  );

  const selectedOrderIds = useOrdersPageStore((s) => s.selectedOrderIds);
  const toggleOrderRow = useOrdersPageStore((s) => s.toggleOrderRow);
  const toggleAllOrdersOnPage = useOrdersPageStore((s) => s.toggleAllOrdersOnPage);
  const clearOrderSelection = useOrdersPageStore((s) => s.clearOrderSelection);

  const [shipOpen, setShipOpen] = useState(false);
  const [shipOrder, setShipOrder] = useState<Order | null>(null);

  const { data, isLoading, isError, error, refetch } = useOrders(filters);
  const summaryQuery = useOrderSummary();
  const connectionsQuery = useMarketplaceConnections();
  const triggerSyncMutation = useTriggerManualSync();

  const [labelLoadingId, setLabelLoadingId] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);

  const downloadLabel = async (order: Order): Promise<void> => {
    setLabelLoadingId(order.id);
    try {
      const res = await api.get(`/orders/${order.id}/shipping-label`, {
        responseType: 'blob',
      });
      downloadBlob(
        res.data as Blob,
        `etiket-${order.platformOrderId.replace(/[^a-zA-Z0-9._-]+/g, '_')}.pdf`,
      );
      toast.success('Kargo etiketi indirildi');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLabelLoadingId(null);
    }
  };

  const downloadInvoice = async (order: Order): Promise<void> => {
    setInvoiceLoadingId(order.id);
    try {
      const res = await api.get(`/invoices/order/${order.id}`, { responseType: 'blob' });
      downloadBlob(
        res.data as Blob,
        `fatura-${order.platformOrderId.replace(/[^a-zA-Z0-9._-]+/g, '_')}.pdf`,
      );
      toast.success('Fatura PDF indirildi');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const total = data?.total ?? 0;
  const limit = filters.limit ?? PAGE_SIZE_DEFAULT;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const hasMarketplaceConnections =
    connectionsQuery.data === undefined
      ? null
      : (connectionsQuery.data ?? []).some((c) => c.isActive);

  const selectedIdSet = useMemo(
    () => new Set(selectedOrderIds),
    [selectedOrderIds],
  );

  const hasActiveOrderFilters = useMemo(() => {
    return Boolean(
      filters.platforms?.trim() ||
        filters.statuses?.trim() ||
        filters.startDate?.trim() ||
        filters.endDate?.trim() ||
        filters.search?.trim() ||
        filters.cargoProvider?.trim() ||
        filters.minTotal !== undefined ||
        filters.maxTotal !== undefined,
    );
  }, [filters]);

  useEffect(() => {
    clearOrderSelection();
  }, [
    clearOrderSelection,
    filters.page,
    filters.platforms,
    filters.statuses,
    filters.startDate,
    filters.endDate,
    filters.search,
    filters.cargoProvider,
    filters.minTotal,
    filters.maxTotal,
  ]);

  const handleRowClick = (order: Order): void => {
    void navigate(`/orders/${order.id}`);
  };

  const selectedRows = data?.items.filter((o) => selectedIdSet.has(o.id)) ?? [];

  const showSticky = selectedOrderIds.length > 0;

  const pullOrdersForConnections = (): void => {
    const conns = (connectionsQuery.data ?? []).filter((c) => c.isActive);
    if (conns.length === 0) {
      toast.error('Aktif pazaryeri bağlantısı yok.');
      return;
    }
    for (const c of conns) {
      triggerSyncMutation.mutate(c.id);
    }
    toast.info(`${String(conns.length)} bağlantı için senkron kuyruğa alındı.`);
  };

  return (
    <div className={`space-y-6 ${showSticky ? 'pb-24' : ''}`}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {t('orders.title')}
        </h1>
        <p className="text-muted-foreground">{t('orders.subtitle')}</p>
      </div>

      <OrdersKpiRow summary={summaryQuery.data} loading={summaryQuery.isPending} />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(ORDER_DATE_PRESET_LABELS) as OrderDatePreset[]).map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant={datePreset === preset ? 'default' : 'outline'}
            onClick={() => {
              applyDatePreset(preset);
            }}
          >
            {ORDER_DATE_PRESET_LABELS[preset]}
          </Button>
        ))}
      </div>

      <AdvancedFilters
        filters={orderFilterConfig}
        values={urlFilters}
        onChange={handleFilterChange}
        onReset={resetUrlFilters}
      />

      {isLoading ? <OrdersPageSkeleton /> : null}

      {isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(error)}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              void refetch();
            }}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && data && data.items.length === 0 ? (
        <TablePageEmptyState
          hasMarketplaceConnections={hasMarketplaceConnections}
          connectionsLoading={connectionsQuery.isLoading}
          hasActiveFilters={hasActiveOrderFilters}
          onStartSync={pullOrdersForConnections}
          syncLabel="Senkronizasyonu başlat"
          emptyTitle="Henüz sipariş yok"
          emptyDescription="Pazar yeri bağlantısı ekleyerek senkronizasyonu başlatın."
          noConnectionDescription="Pazar yeri bağlantısı ekleyerek senkronizasyonu başlatın."
        />
      ) : null}

      {!isLoading && !isError && data && data.items.length > 0 ? (
        <OrdersTable
          orders={data.items}
          selectedIds={selectedIdSet}
          onToggleRow={(id, selected) => {
            toggleOrderRow(id, selected);
          }}
          onToggleAllOnPage={(selected) => {
            toggleAllOrdersOnPage(
              data.items.map((o) => o.id),
              selected,
            );
          }}
          onRowClick={handleRowClick}
          onPrintLabel={(order) => {
            void downloadLabel(order);
          }}
          onShip={(order) => {
            setShipOrder(order);
            setShipOpen(true);
          }}
          onDownloadInvoice={(order) => {
            void downloadInvoice(order);
          }}
          labelLoadingId={labelLoadingId}
          invoiceLoadingId={invoiceLoadingId}
        />
      ) : null}

      {!isLoading && !isError && data && data.items.length > 0 ? (
        <DataTablePagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={(p) => {
            setUrlFilters({ page: p });
          }}
          onLimitChange={(nextLimit) => {
            setUrlFilters({ limit: nextLimit, page: 1 });
          }}
        />
      ) : null}

      {showSticky ? (
        <OrderBulkActions
          selectedOrderIds={selectedOrderIds}
          selectedOrders={selectedRows}
          onClearSelection={clearOrderSelection}
        />
      ) : null}

      <ShipOrderModal
        open={shipOpen}
        onOpenChange={setShipOpen}
        order={shipOrder}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ['orders'] });
        }}
      />
    </div>
  );
}
