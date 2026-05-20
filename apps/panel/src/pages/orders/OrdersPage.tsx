import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileArchive, Loader2, Package, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CargoProvider } from '@senkronize/shared';

import { ShipOrderModal } from '@/components/orders/ShipOrderModal';
import { AdvancedFilters } from '@/components/AdvancedFilters';
import { DataTablePagination } from '@/components/DataTablePagination';
import { TablePageEmptyState } from '@/components/TablePageEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMarketplaceConnections, useTriggerManualSync } from '@/hooks/useConnections';
import { useErpConnections, useSyncOrderToErp } from '@/hooks/useErpConnections';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { track } from '@/lib/analytics';
import { api, getApiErrorMessage } from '@/lib/api';
import { CARGO_PROVIDER_OPTIONS } from '@/lib/cargo-providers';
import { downloadOrdersExcel } from '@/lib/order-export';
import { ORDER_STATUS_I18N_KEY } from '@/lib/order-i18n';
import { useOrdersPageStore } from '@/store/tablePages.store';
import type {
  BulkResult,
  Order,
  OrderFilters as OrderFiltersState,
  OrderStatus,
} from '@/types/order';

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

const ERP_LABEL_TR: Record<string, string> = {
  BIZIMHESAP: 'Bizim Hesap',
  PARASUT: 'Paraşüt',
  LOGO: 'Logo',
  MIKRO: 'Mikro',
  LUCA: 'Luca',
  TSOFT: 'T-Soft',
  TICIMAX: 'Ticimax',
  NETSIS: 'Netsis',
  ETA: 'ETA V8',
  KOLAYBI: 'Kolaybi',
  ZIRVE: 'Zirve',
  NEBIM: 'Nebim V3',
  EBA: 'eBA',
  SAP_B1: 'SAP Business One',
  ISNET: 'İşnet',
};

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ALL_STATUSES = Object.keys(ORDER_STATUS_I18N_KEY) as OrderStatus[];

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

  const [cargoOpen, setCargoOpen] = useState(false);
  const [bulkCargoProvider, setBulkCargoProvider] = useState<CargoProvider>('YURTICI');

  const [shipOpen, setShipOpen] = useState(false);
  const [shipOrder, setShipOrder] = useState<Order | null>(null);
  const [shipBulkMode, setShipBulkMode] = useState(false);

  const [statusOpen, setStatusOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('PICKING');

  const [erpOpen, setErpOpen] = useState(false);
  const [erpConnectionId, setErpConnectionId] = useState('');

  const { data, isLoading, isError, error, refetch } = useOrders(filters);
  const summaryQuery = useOrderSummary();
  const connectionsQuery = useMarketplaceConnections();
  const erpConnectionsQuery = useErpConnections();
  const syncToErpMutation = useSyncOrderToErp();
  const triggerSyncMutation = useTriggerManualSync();

  const [labelLoadingId, setLabelLoadingId] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);

  const bulkInvoiceMutation = useMutation({
    mutationFn: async (orderIds: string[]): Promise<Blob> => {
      const res = await api.post('/orders/bulk/invoice', { orderIds }, { responseType: 'blob' });
      return res.data as Blob;
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faturalar-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Toplu fatura ZIP indirildi');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const bulkLabelsMutation = useMutation({
    mutationFn: async (orderIds: string[]): Promise<Blob> => {
      const res = await api.post(
        '/orders/bulk/shipping-labels',
        { orderIds },
        { responseType: 'blob' },
      );
      return res.data as Blob;
    },
    onSuccess: (blob) => {
      downloadBlob(blob, `etiketler-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success('Toplu etiket ZIP indirildi');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

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

  const bulkCargoMutation = useMutation({
    mutationFn: async (payload: {
      orderIds: string[];
      cargoProvider: CargoProvider;
    }): Promise<BulkResult> => {
      const { data } = await api.post<BulkResult>('/orders/bulk/cargo', payload);
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (result.failed > 0) {
        toast.warning(
          `${String(result.success)} başarılı, ${String(result.failed)} başarısız`,
        );
      } else {
        toast.success('Kargo şirketi atandı');
      }
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async (payload: {
      orderIds: string[];
      status: OrderStatus;
    }): Promise<BulkResult> => {
      const { data } = await api.post<BulkResult>('/orders/bulk/status', payload);
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (result.failed > 0) {
        toast.warning(
          `${String(result.success)} başarılı, ${String(result.failed)} başarısız`,
        );
      } else {
        toast.success('Sipariş durumları güncellendi');
      }
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

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

  const activeErpConnections = useMemo(
    () => (erpConnectionsQuery.data ?? []).filter((c) => c.isActive),
    [erpConnectionsQuery.data],
  );

  useEffect(() => {
    const first = activeErpConnections[0]?.id ?? '';
    setErpConnectionId(first);
  }, [activeErpConnections]);

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
            setShipBulkMode(false);
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
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur dark:shadow-[0_-4px_16px_rgba(0,0,0,0.45)] supports-[padding:max(0px)]:pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="secondary" className="w-fit">
              {t('orders.bulk.selected', { count: selectedOrderIds.length })}
            </Badge>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                disabled={selectedRows.length === 0}
                onClick={() => {
                  setBulkCargoProvider('YURTICI');
                  setCargoOpen(true);
                }}
              >
                <Truck className="h-3.5 w-3.5" aria-hidden />
                Toplu kargo ata
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                disabled={
                  selectedRows.length === 0 ||
                  bulkLabelsMutation.isPending
                }
                onClick={() => {
                  bulkLabelsMutation.mutate(selectedOrderIds);
                  track('orders_bulk_labels', { count: selectedOrderIds.length });
                }}
              >
                {bulkLabelsMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <FileArchive className="h-3.5 w-3.5" aria-hidden />
                )}
                Etiket ZIP indir
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                disabled={selectedRows.length === 0}
                onClick={() => {
                  setShipOrder(null);
                  setShipBulkMode(true);
                  setShipOpen(true);
                }}
              >
                <Truck className="h-3.5 w-3.5" aria-hidden />
                Toplu kargoya ver
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                disabled={
                  selectedRows.length === 0 ||
                  selectedRows.length > 50 ||
                  bulkInvoiceMutation.isPending
                }
                onClick={() => {
                  bulkInvoiceMutation.mutate(selectedOrderIds);
                  track('orders_bulk_invoice', { count: selectedOrderIds.length });
                }}
              >
                {bulkInvoiceMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <FileArchive className="h-3.5 w-3.5" aria-hidden />
                )}
                {t('orders.bulk.bulkInvoice')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={selectedRows.length === 0}
                onClick={() => {
                  setBulkStatus('PICKING');
                  setStatusOpen(true);
                }}
              >
                {t('orders.bulk.updateStatus')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={selectedRows.length === 0 || !data}
                onClick={() => {
                  if (!data) {
                    return;
                  }
                  downloadOrdersExcel(data.items.filter((o) => selectedIdSet.has(o.id)));
                  track('orders_exported', {
                    count: selectedRows.length,
                    format: 'excel',
                  });
                  toast.success('Excel dosyası indirildi');
                }}
              >
                <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
                Excel&apos;e aktar
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                disabled={
                  selectedRows.length === 0 ||
                  activeErpConnections.length === 0 ||
                  syncToErpMutation.isPending
                }
                onClick={() => {
                  setErpOpen(true);
                }}
              >
                <Package className="h-3.5 w-3.5" aria-hidden />
                {t('orders.bulk.exportToErp')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={cargoOpen} onOpenChange={setCargoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Toplu kargo şirketi ata</DialogTitle>
            <DialogDescription>
              Seçili siparişlere aynı kargo firması atanır.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="bulk-provider">Kargo firması</Label>
              <Select
                value={bulkCargoProvider}
                onValueChange={(v) => {
                  setBulkCargoProvider(v as CargoProvider);
                }}
              >
                <SelectTrigger id="bulk-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARGO_PROVIDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCargoOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={bulkCargoMutation.isPending || selectedOrderIds.length === 0}
              onClick={() => {
                bulkCargoMutation.mutate(
                  {
                    orderIds: selectedOrderIds,
                    cargoProvider: bulkCargoProvider,
                  },
                  {
                    onSuccess: () => {
                      setCargoOpen(false);
                      clearOrderSelection();
                    },
                  },
                );
              }}
            >
              {bulkCargoMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShipOrderModal
        open={shipOpen}
        onOpenChange={setShipOpen}
        order={shipBulkMode ? null : shipOrder}
        orderIds={shipBulkMode ? selectedOrderIds : undefined}
        onSuccess={() => {
          if (shipBulkMode) {
            clearOrderSelection();
          }
        }}
      />

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Toplu durum güncelle</DialogTitle>
            <DialogDescription>
              Seçili siparişlerin durumu aşağıdaki değere ayarlanır.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="bulk-order-status">Durum</Label>
            <Select
              value={bulkStatus}
              onValueChange={(v) => {
                setBulkStatus(v as OrderStatus);
              }}
            >
              <SelectTrigger id="bulk-order-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {t(ORDER_STATUS_I18N_KEY[st])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={bulkStatusMutation.isPending || selectedOrderIds.length === 0}
              onClick={() => {
                bulkStatusMutation.mutate(
                  { orderIds: selectedOrderIds, status: bulkStatus },
                  {
                    onSuccess: () => {
                      setStatusOpen(false);
                      clearOrderSelection();
                    },
                  },
                );
              }}
            >
              {bulkStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={erpOpen} onOpenChange={setErpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ERP&apos;ye aktar</DialogTitle>
            <DialogDescription>
              Seçili siparişler sırayla seçili ERP bağlantısına aktarılır.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="bulk-erp-conn">ERP bağlantısı</Label>
            <Select
              value={erpConnectionId}
              onValueChange={setErpConnectionId}
            >
              <SelectTrigger id="bulk-erp-conn">
                <SelectValue placeholder="Bağlantı seçin" />
              </SelectTrigger>
              <SelectContent>
                {activeErpConnections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {ERP_LABEL_TR[c.erpType] ?? c.erpType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setErpOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!erpConnectionId || syncToErpMutation.isPending}
              onClick={() => {
                if (!erpConnectionId) {
                  return;
                }
                void (async (): Promise<void> => {
                  let ok = 0;
                  for (const o of selectedRows) {
                    try {
                      await syncToErpMutation.mutateAsync({
                        connectionId: erpConnectionId,
                        orderId: o.id,
                      });
                      ok += 1;
                    } catch {
                      /* toast from mutation */
                    }
                  }
                  toast.success(`${String(ok)} sipariş ERP kuyruğuna iletildi`);
                  setErpOpen(false);
                  clearOrderSelection();
                })();
              }}
            >
              {syncToErpMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Aktar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
