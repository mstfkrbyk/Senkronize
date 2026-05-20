import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileArchive, Loader2, Package, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

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
import { Input } from '@/components/ui/input';
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
import { ORDER_STATUS_I18N_KEY } from '@/lib/order-i18n';
import { useOrdersPageStore } from '@/store/tablePages.store';
import type { Order, OrderFilters as OrderFiltersState, OrderStatus } from '@/types/order';

import {
  buildOrderFilterConfig,
  ORDER_FILTER_DEFAULTS,
  ORDER_PAGE_SIZE,
} from './orderFilters.config';
import { OrderDetailSheet } from './OrderDetailSheet';
import { OrdersTable } from './OrdersTable';
import { useOrders } from './hooks/useOrders';

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

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadOrdersCsv(rows: Order[]): void {
  const headers = [
    'platform',
    'siparis_no',
    'musteri',
    'tutar',
    'para_birimi',
    'durum',
    'kargo_firmasi',
    'takip_no',
    'tarih',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((o) =>
      [
        escapeCsvCell(o.platform),
        escapeCsvCell(o.platformOrderId),
        escapeCsvCell(o.customerName),
        escapeCsvCell(o.totalAmount),
        escapeCsvCell(o.currency),
        escapeCsvCell(o.status),
        escapeCsvCell(o.cargoProvider ?? ''),
        escapeCsvCell(o.cargoTrackingNumber ?? ''),
        escapeCsvCell(o.platformCreatedAt),
      ].join(','),
    ),
  ];
  const blob = new Blob([`\ufeff${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `siparisler-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const handleFilterChange = useCallback(
    (values: Record<string, unknown>): void => {
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

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [cargoOpen, setCargoOpen] = useState(false);
  const [cargoTracking, setCargoTracking] = useState('');
  const [cargoProvider, setCargoProvider] = useState('');

  const [statusOpen, setStatusOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('PICKING');

  const [erpOpen, setErpOpen] = useState(false);
  const [erpConnectionId, setErpConnectionId] = useState('');

  const { data, isLoading, isError, error, refetch } = useOrders(filters);
  const connectionsQuery = useMarketplaceConnections();
  const erpConnectionsQuery = useErpConnections();
  const syncToErpMutation = useSyncOrderToErp();
  const triggerSyncMutation = useTriggerManualSync();

  const bulkInvoiceMutation = useMutation({
    mutationFn: async (orderIds: string[]): Promise<Blob> => {
      const res = await api.post('/invoices/bulk', { orderIds }, { responseType: 'blob' });
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

  const patchStatusMutation = useMutation({
    mutationFn: async (args: {
      id: string;
      status: OrderStatus;
      cargoTrackingNumber?: string;
      cargoProvider?: string;
    }): Promise<Order> => {
      const { data: res } = await api.patch<Order>(`/orders/${args.id}/status`, {
        status: args.status,
        cargoTrackingNumber: args.cargoTrackingNumber,
        cargoProvider: args.cargoProvider,
      });
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
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
    setSelectedOrder(order);
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean): void => {
    setSheetOpen(open);
    if (!open) {
      setSelectedOrder(null);
    }
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
                  setCargoTracking('');
                  setCargoProvider('');
                  setCargoOpen(true);
                }}
              >
                <Truck className="h-3.5 w-3.5" aria-hidden />
                {t('orders.bulk.addCargo')}
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
                  downloadOrdersCsv(data.items.filter((o) => selectedIdSet.has(o.id)));
                  track('orders_exported', {
                    count: selectedRows.length,
                    format: 'csv',
                  });
                  toast.success('CSV indirildi');
                }}
              >
                <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
                {t('orders.bulk.exportCsv')}
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

      <OrderDetailSheet
        order={selectedOrder}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onCargoUpdated={(o) => {
          setSelectedOrder(o);
        }}
      />

      <Dialog open={cargoOpen} onOpenChange={setCargoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Toplu kargo bilgisi</DialogTitle>
            <DialogDescription>
              Seçili siparişler kargoya verildi olarak işaretlenir ve kargo alanları
              güncellenir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="bulk-track">Takip numarası</Label>
              <Input
                id="bulk-track"
                value={cargoTracking}
                onChange={(e) => {
                  setCargoTracking(e.target.value);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bulk-provider">Kargo firması</Label>
              <Input
                id="bulk-provider"
                value={cargoProvider}
                onChange={(e) => {
                  setCargoProvider(e.target.value);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCargoOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={patchStatusMutation.isPending}
              onClick={() => {
                void (async (): Promise<void> => {
                  try {
                    for (const o of selectedRows) {
                      await patchStatusMutation.mutateAsync({
                        id: o.id,
                        status: 'SHIPPED',
                        cargoTrackingNumber: cargoTracking.trim() || undefined,
                        cargoProvider: cargoProvider.trim() || undefined,
                      });
                    }
                    toast.success('Kargo bilgileri güncellendi');
                    setCargoOpen(false);
                    clearOrderSelection();
                  } catch (err: unknown) {
                    toast.error(getApiErrorMessage(err));
                  }
                })();
              }}
            >
              {patchStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              disabled={patchStatusMutation.isPending}
              onClick={() => {
                void (async (): Promise<void> => {
                  try {
                    for (const o of selectedRows) {
                      await patchStatusMutation.mutateAsync({
                        id: o.id,
                        status: bulkStatus,
                      });
                    }
                    toast.success('Sipariş durumları güncellendi');
                    setStatusOpen(false);
                    clearOrderSelection();
                  } catch (err: unknown) {
                    toast.error(getApiErrorMessage(err));
                  }
                })();
              }}
            >
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
