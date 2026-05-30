import { CheckCircle2, Circle, ExternalLink, FileDown, Loader2, PackageSearch } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { InvoicePreview } from '@/components/InvoicePreview';
import { ProductImage } from '@/components/ProductImage';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useErpConnections, useSyncOrderToErp } from '@/hooks/useErpConnections';
import { api, getApiErrorMessage } from '@/lib/api';
import { buildCargoTrackingUrl } from '@/lib/cargo-tracking';
import { ORDER_STATUS_I18N_KEY } from '@/lib/order-i18n';
import { orderStatusTone } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import { useAuthStore } from '@/store/auth.store';
import type { Order, OrderStatus } from '@/types/order';

interface CargoRateComparisonRow {
  connectionId: string;
  provider: string;
  providerLabel: string;
  price: number;
  currency: string;
  serviceName: string;
  estimatedTransitDays?: number;
}

interface Props {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCargoUpdated?: (order: Order) => void;
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

function statusRank(status: OrderStatus): number {
  switch (status) {
    case 'DELIVERED':
      return 3;
    case 'SHIPPED':
      return 2;
    case 'INVOICED':
    case 'PICKING':
      return 1;
    case 'NEW':
    default:
      return 0;
  }
}

function formatTry(amount: string, currency: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(Number(amount));
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function OrderDetailSheet({
  order,
  open,
  onOpenChange,
  onCargoUpdated,
}: Props): ReactElement {
  const { t } = useTranslation();
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const queryClient = useQueryClient();
  const erpConnectionsQuery = useErpConnections();
  const syncToErpMutation = useSyncOrderToErp();
  const [tracking, setTracking] = useState('');
  const [provider, setProvider] = useState('');
  const [erpConnectionId, setErpConnectionId] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState('');

  const activeErpConnections = useMemo(
    () =>
      (erpConnectionsQuery.data ?? []).filter(
        (c) => c.isActive && c.role === 'PRIMARY',
      ),
    [erpConnectionsQuery.data],
  );

  const fulfillmentSteps = useMemo(
    () =>
      [
        { key: 'created', label: t('orders.detail.tracking.received'), minRank: 0 },
        { key: 'prep', label: t('orders.detail.tracking.preparing'), minRank: 1 },
        { key: 'ship', label: t('orders.detail.tracking.shipped'), minRank: 2 },
        { key: 'done', label: t('orders.detail.tracking.delivered'), minRank: 3 },
      ] as const,
    [t],
  );

  useEffect(() => {
    if (order) {
      setTracking(order.cargoTrackingNumber ?? '');
      setProvider(order.cargoProvider ?? '');
    }
  }, [order]);

  useEffect(() => {
    if (!order?.id) {
      return;
    }
    const first = activeErpConnections[0]?.id ?? '';
    setErpConnectionId(first);
  }, [order?.id, activeErpConnections]);

  const detailQuery = useQuery({
    queryKey: ['orders', 'detail', order?.id],
    queryFn: async (): Promise<Order> => {
      const { data } = await api.get<Order>(`/orders/${order?.id ?? ''}`);
      return data;
    },
    enabled: open && !!order?.id,
  });

  const displayOrder = detailQuery.data ?? order;

  const invoicePdfMutation = useMutation({
    mutationFn: async (orderId: string): Promise<Blob> => {
      const res = await api.get(`/invoices/order/${orderId}`, { responseType: 'blob' });
      return res.data as Blob;
    },
    onSuccess: (pdfBlob: Blob) => {
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 120_000);
      toast.success('Fatura PDF açıldı');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const cargoMutation = useMutation({
    mutationFn: async (): Promise<Order> => {
      if (!order) {
        throw new Error('Sipariş seçilmedi');
      }
      const { data } = await api.patch<Order>(`/orders/${order.id}/status`, {
        status: 'SHIPPED',
        cargoTrackingNumber: tracking.trim() || undefined,
        cargoProvider: provider.trim() || undefined,
      });
      return data;
    },
    onSuccess: (updated) => {
      toast.success('Kargo bilgisi güncellendi');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({
        queryKey: ['orders', 'detail', updated.id],
      });
      onCargoUpdated?.(updated);
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  const compareRatesQuery = useQuery({
    queryKey: ['cargo', 'rates', 'compare', displayOrder?.id],
    queryFn: async (): Promise<CargoRateComparisonRow[]> => {
      const { data } = await api.post<CargoRateComparisonRow[]>(`/cargo/rates/compare`, {
        orderId: displayOrder!.id,
      });
      return data;
    },
    enabled: compareDialogOpen && !!displayOrder?.id,
  });

  const shipFromCompareMutation = useMutation({
    mutationFn: async (row: CargoRateComparisonRow): Promise<void> => {
      if (!displayOrder) {
        throw new Error('Sipariş seçilmedi');
      }
      await api.post(`/cargo/shipments`, {
        orderId: displayOrder.id,
        cargoProvider: row.provider,
      });
    },
    onSuccess: async () => {
      toast.success('Gönderi oluşturuldu ve takip numarası kaydedildi');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (displayOrder) {
        void queryClient.invalidateQueries({
          queryKey: ['orders', 'detail', displayOrder.id],
        });
        const { data: refreshed } = await api.get<Order>(`/orders/${displayOrder.id}`);
        onCargoUpdated?.(refreshed);
      }
      setCompareDialogOpen(false);
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const cancellationRequestMutation = useMutation({
    mutationFn: async (args: { orderId: string; note: string }): Promise<Order> => {
      const { data } = await api.post<Order>(
        `/orders/${args.orderId}/cancellation-request`,
        { note: args.note.trim().length > 0 ? args.note.trim() : undefined },
      );
      return data;
    },
    onSuccess: (updated) => {
      toast.success('İptal talebi kaydedildi');
      setCancelDialogOpen(false);
      setCancelNote('');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({
        queryKey: ['orders', 'detail', updated.id],
      });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const canEditCargo =
    displayOrder &&
    !['CANCELLED', 'DELIVERED', 'RETURNED'].includes(displayOrder.status);

  const trackingUrl =
    displayOrder?.cargoTrackingNumber &&
    displayOrder.cargoTrackingNumber.trim().length > 0
      ? buildCargoTrackingUrl(
          displayOrder.cargoTrackingNumber,
          displayOrder.cargoProvider,
        )
      : '';

  const currentRank = displayOrder
    ? statusRank(displayOrder.status)
    : 0;

  const canRequestCancellation =
    !!displayOrder &&
    !['CANCELLED', 'DELIVERED', 'RETURNED'].includes(displayOrder.status);

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      {order ? (
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="space-y-3 text-left">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
              <div className="min-w-0 flex-1 space-y-1">
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  <span aria-hidden>
                    {getMarketplaceBranding(order.platform).logo}
                  </span>
                  {t('orders.detail.heading', { orderNo: order.platformOrderId })}
                </SheetTitle>
                <SheetDescription>
                  {getMarketplaceBranding(order.platform).label} ·{' '}
                  {formatDate(order.platformCreatedAt)}
                </SheetDescription>
              </div>
              {displayOrder ? (
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0 px-3 py-1 text-sm font-semibold',
                    orderStatusTone(displayOrder.status),
                  )}
                >
                  {t(ORDER_STATUS_I18N_KEY[displayOrder.status])}
                </Badge>
              ) : null}
            </div>
          </SheetHeader>

          {detailQuery.isPending ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : null}

          {displayOrder ? (
            <div className="mt-4 space-y-6">
              {displayOrder.cancellationRequestedAt ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                  <span className="font-medium">İptal talebi kayıtlı</span>
                  <p className="mt-1 text-sky-900">
                    {formatDate(displayOrder.cancellationRequestedAt)}
                    {displayOrder.cancellationRequestNote
                      ? ` — ${displayOrder.cancellationRequestNote}`
                      : ''}
                  </p>
                </div>
              ) : null}

              {canRequestCancellation ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-amber-200 text-amber-950 hover:bg-amber-50"
                  onClick={() => {
                    setCancelDialogOpen(true);
                  }}
                >
                  İptal talebi oluştur
                </Button>
              ) : null}

              {['CANCELLED', 'RETURNED'].includes(displayOrder.status) ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Bu sipariş için operasyon zaman çizelgesi gösterilmez (
                  {t(ORDER_STATUS_I18N_KEY[displayOrder.status])}).
                </div>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {t('orders.detail.shipping.timeline')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                  <ul className="space-y-3 border-l-2 border-muted pl-4">
                    {fulfillmentSteps.map((step, idx) => {
                      const done = currentRank >= step.minRank;
                      const Icon = done ? CheckCircle2 : Circle;
                      return (
                        <li key={step.key} className="flex gap-3">
                          <Icon
                            className={
                              done
                                ? 'mt-0.5 h-5 w-5 shrink-0 text-green-600'
                                : 'mt-0.5 h-5 w-5 shrink-0 text-muted-foreground'
                            }
                            aria-hidden
                          />
                          <div>
                            <p
                              className={
                                done
                                  ? 'text-sm font-medium text-foreground'
                                  : 'text-sm text-muted-foreground'
                              }
                            >
                              {idx + 1}. {step.label}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('orders.customer')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0 text-sm">
                  <p>{displayOrder.customerName}</p>
                  <p className="text-muted-foreground">
                    {t('orders.amount')}:{' '}
                    <span className="font-semibold text-foreground">
                      {formatTry(displayOrder.totalAmount, displayOrder.currency)}
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('orders.detail.invoice.title')}</CardTitle>
                  <CardDescription>
                    Sunucuda üretilen PDF veya istemci tarafı önizleme ile PDF alın.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full gap-2"
                  disabled={invoicePdfMutation.isPending}
                  onClick={() => {
                    invoicePdfMutation.mutate(displayOrder.id);
                  }}
                >
                  {invoicePdfMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <FileDown className="h-4 w-4" aria-hidden />
                  )}
                  {t('orders.detail.documents.downloadPdf')}
                </Button>
                <div>
                  <InvoicePreview
                    order={displayOrder}
                    organizationName={currentOrg?.name ?? '—'}
                  />
                </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('orders.detail.products.title')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0 pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14" />
                        <TableHead>{t('orders.detail.products.product')}</TableHead>
                        <TableHead>{t('products.barcode')}</TableHead>
                        <TableHead className="text-right">{t('orders.detail.products.qty')}</TableHead>
                        <TableHead className="text-right">{t('orders.detail.products.unitPrice')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayOrder.items.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-muted-foreground"
                          >
                            Satır bulunamadı
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayOrder.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="w-14 p-2">
                              {item.thumbnailUrl ? (
                                <ProductImage
                                  src={item.thumbnailUrl}
                                  alt=""
                                  size={40}
                                  className="h-10 w-10 rounded-md"
                                />
                              ) : (
                                <div
                                  className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground"
                                  aria-hidden
                                >
                                  —
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[140px] truncate">
                              {item.productName ?? item.sku}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {item.barcode}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatTry(item.unitPrice, displayOrder.currency)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {displayOrder.cargoTrackingNumber ||
              displayOrder.cargoProvider ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Kargo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0 text-sm">
                  {displayOrder.cargoProvider ? (
                    <p className="text-muted-foreground">
                      {displayOrder.cargoProvider}
                    </p>
                  ) : null}
                  {displayOrder.cargoTrackingNumber ? (
                    <p className="font-mono">
                      Takip:{' '}
                      {trackingUrl ? (
                        <a
                          href={trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-600 underline-offset-4 hover:underline"
                        >
                          {displayOrder.cargoTrackingNumber}
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      ) : (
                        displayOrder.cargoTrackingNumber
                      )}
                    </p>
                  ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {activeErpConnections.length > 0 ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('orders.list.erpColumn')}</CardTitle>
                    <CardDescription>
                      Siparişi seçili ERP bağlantısında fatura olarak oluşturur.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-2">
                      <Label htmlFor="erp-conn">{t('orders.detail.invoice.erpConnection')}</Label>
                      <Select
                        value={erpConnectionId}
                        onValueChange={setErpConnectionId}
                      >
                        <SelectTrigger id="erp-conn">
                          <SelectValue placeholder={t('orders.detail.invoice.erpConnectionPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {activeErpConnections.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {ERP_LABEL_TR[c.erpType] ?? c.erpType}
                              {c.accountLabel ? ` (${c.accountLabel})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={
                        !erpConnectionId ||
                        syncToErpMutation.isPending ||
                        !displayOrder
                      }
                      onClick={() => {
                        if (!displayOrder || !erpConnectionId) {
                          return;
                        }
                        syncToErpMutation.mutate(
                          {
                            connectionId: erpConnectionId,
                            orderId: displayOrder.id,
                          },
                          {
                            onSuccess: (res) => {
                              toast.success('Fatura ERP’de oluşturuldu', {
                                description: `Fatura no: ${res.invoiceNo}`,
                              });
                              void queryClient.invalidateQueries({
                                queryKey: ['orders', 'detail', displayOrder.id],
                              });
                            },
                            onError: (err) => {
                              toast.error(getApiErrorMessage(err));
                            },
                          },
                        );
                      }}
                    >
                      {syncToErpMutation.isPending
                        ? 'Gönderiliyor…'
                        : t('orders.detail.invoice.sendToErp')}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Kargo gönder</CardTitle>
                  <CardDescription>
                    Bağlı kargo hesaplarından fiyatları karşılaştırıp gönderi oluşturabilirsiniz.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full gap-2"
                  disabled={!canEditCargo || !displayOrder}
                  onClick={() => {
                    setCompareDialogOpen(true);
                  }}
                >
                  <PackageSearch className="h-4 w-4 shrink-0" aria-hidden />
                  Kargo gönder
                </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Kargo bilgisi güncelle</CardTitle>
                  <CardDescription>
                    Takip numarası ve kargo firması girerek siparişi kargoda olarak
                    işaretleyin.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-2">
                    <Label htmlFor="cargo-tracking">{t('orders.detail.shipping.trackingNo')}</Label>
                    <Input
                      id="cargo-tracking"
                      name="cargoTrackingNumber"
                      autoComplete="off"
                      value={tracking}
                      onChange={(e) => {
                        setTracking(e.target.value);
                      }}
                      disabled={!canEditCargo}
                      placeholder="Örn. 1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cargo-provider">{t('orders.filters.cargoProvider')}</Label>
                    <Input
                      id="cargo-provider"
                      name="cargoProvider"
                      autoComplete="organization"
                      value={provider}
                      onChange={(e) => {
                        setProvider(e.target.value);
                      }}
                      disabled={!canEditCargo}
                      placeholder={t('orders.filters.cargoPlaceholder')}
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      !canEditCargo ||
                      cargoMutation.isPending ||
                      (!tracking.trim() && !provider.trim())
                    }
                    onClick={() => {
                      cargoMutation.mutate();
                    }}
                  >
                    {cargoMutation.isPending ? t('settings.organizationTab.saving') : 'Güncelle'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </SheetContent>
      ) : null}
    </Sheet>

    <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kargo fiyat karşılaştırması</DialogTitle>
          <DialogDescription>
            Aktif kargo bağlantılarınızdan anlık teklif alınır (UPS, DHL, FedEx gibi
            fiyat API’si olan firmalar listelenir).
          </DialogDescription>
        </DialogHeader>
        {compareRatesQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Fiyatlar yükleniyor…
          </div>
        ) : null}
        {compareRatesQuery.isError ? (
          <p className="py-4 text-sm text-destructive">
            {getApiErrorMessage(compareRatesQuery.error)}
          </p>
        ) : null}
        {compareRatesQuery.data && compareRatesQuery.data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Gösterilecek fiyat teklifi yok. Kargo bağlantılarınızı kontrol edin veya bu
            firmalar fiyat API’sini desteklemiyor olabilir.
          </p>
        ) : null}
        {compareRatesQuery.data && compareRatesQuery.data.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Hizmet</TableHead>
                  <TableHead className="w-20">Süre</TableHead>
                  <TableHead className="text-right">Fiyat</TableHead>
                  <TableHead className="w-28 text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compareRatesQuery.data.map((row) => (
                  <TableRow key={`${row.connectionId}-${row.serviceName}`}>
                    <TableCell className="font-medium">{row.providerLabel}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs">
                      {row.serviceName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.estimatedTransitDays != null
                        ? `${String(row.estimatedTransitDays)} gün`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatMoney(row.price, row.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        disabled={shipFromCompareMutation.isPending}
                        onClick={() => {
                          shipFromCompareMutation.mutate(row);
                        }}
                      >
                        {shipFromCompareMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          'Seç ve gönder'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setCompareDialogOpen(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>İptal talebi</DialogTitle>
          <DialogDescription>
            Pazaryeri tarafında iptal süreci bağlantıya göre değişebilir. Talebiniz
            kaydedilir.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="cancel-note">Açıklama (isteğe bağlı)</Label>
          <Textarea
            id="cancel-note"
            rows={4}
            value={cancelNote}
            placeholder="İptal nedeninizi yazın"
            onChange={(e) => {
              setCancelNote(e.target.value);
            }}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCancelDialogOpen(false);
            }}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            disabled={
              !displayOrder || cancellationRequestMutation.isPending
            }
            onClick={() => {
              if (!displayOrder) {
                return;
              }
              cancellationRequestMutation.mutate({
                orderId: displayOrder.id,
                note: cancelNote,
              });
            }}
          >
            {cancellationRequestMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Talebi gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
