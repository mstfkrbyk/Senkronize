import { CheckCircle2, Circle, ExternalLink, FileDown, Loader2, PackageSearch } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { InvoicePreview } from '@/components/InvoicePreview';
import { ProductImage } from '@/components/ProductImage';
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
import { ORDER_STATUS_LABEL_TR, orderStatusTone } from '@/lib/order-status';
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

const FULFILLMENT_STEPS: readonly {
  key: string;
  label: string;
  minRank: number;
}[] = [
  { key: 'created', label: 'Sipariş oluşturuldu', minRank: 0 },
  { key: 'prep', label: 'Hazırlandı', minRank: 1 },
  { key: 'ship', label: 'Kargoya verildi', minRank: 2 },
  { key: 'done', label: 'Teslim edildi', minRank: 3 },
];

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
    () => (erpConnectionsQuery.data ?? []).filter((c) => c.isActive),
    [erpConnectionsQuery.data],
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
    onSuccess: () => {
      const url = URL.createObjectURL(blob);
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
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="text-left">
            <SheetTitle className="flex flex-wrap items-center gap-2">
              <span aria-hidden>
                {getMarketplaceBranding(order.platform).logo}
              </span>
              Sipariş {order.platformOrderId}
            </SheetTitle>
            <SheetDescription>
              {getMarketplaceBranding(order.platform).label} ·{' '}
              {formatDate(order.platformCreatedAt)}
            </SheetDescription>
          </SheetHeader>

          {detailQuery.isPending ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : null}

          {displayOrder ? (
            <div className="mt-4 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Durum</span>
                <Badge
                  variant="outline"
                  className={orderStatusTone(displayOrder.status)}
                >
                  {ORDER_STATUS_LABEL_TR[displayOrder.status]}
                </Badge>
              </div>

              {['CANCELLED', 'RETURNED'].includes(displayOrder.status) ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Bu sipariş için operasyon zaman çizelgesi gösterilmez (
                  {ORDER_STATUS_LABEL_TR[displayOrder.status]}).
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-sm font-medium">Zaman çizelgesi</p>
                  <ul className="space-y-3">
                    {FULFILLMENT_STEPS.map((step, idx) => {
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
                </div>
              )}

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">Müşteri</p>
                <p className="mt-1 text-sm">{displayOrder.customerName}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tutar:{' '}
                  <span className="font-semibold text-foreground">
                    {formatTry(displayOrder.totalAmount, displayOrder.currency)}
                  </span>
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Fatura</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sunucuda üretilen PDF veya istemci tarafı önizleme ile PDF alın.
                </p>
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
                  Fatura İndir (PDF)
                </Button>
                <div className="mt-4">
                  <InvoicePreview
                    order={displayOrder}
                    organizationName={currentOrg?.name ?? '—'}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Ürünler</p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14" />
                        <TableHead>Ürün</TableHead>
                        <TableHead>Barkod</TableHead>
                        <TableHead className="text-right">Adet</TableHead>
                        <TableHead className="text-right">Birim</TableHead>
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
                </div>
              </div>

              {displayOrder.cargoTrackingNumber ||
              displayOrder.cargoProvider ? (
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Kargo</p>
                  {displayOrder.cargoProvider ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {displayOrder.cargoProvider}
                    </p>
                  ) : null}
                  {displayOrder.cargoTrackingNumber ? (
                    <p className="mt-1 font-mono text-sm">
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
                </div>
              ) : null}

              {activeErpConnections.length > 0 ? (
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">ERP</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Siparişi seçili ERP bağlantısında fatura olarak oluşturur.
                  </p>
                  <div className="mt-3 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="erp-conn">ERP bağlantısı</Label>
                      <Select
                        value={erpConnectionId}
                        onValueChange={setErpConnectionId}
                      >
                        <SelectTrigger id="erp-conn">
                          <SelectValue placeholder="Bağlantı seçin" />
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
                        : 'Faturayı ERP’ye Gönder'}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Kargo gönder</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bağlı kargo hesaplarından fiyatları karşılaştırıp gönderi oluşturabilirsiniz.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full gap-2"
                  disabled={!canEditCargo || !displayOrder}
                  onClick={() => {
                    setCompareDialogOpen(true);
                  }}
                >
                  <PackageSearch className="h-4 w-4 shrink-0" aria-hidden />
                  Kargo gönder
                </Button>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Kargo bilgisi güncelle</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Takip numarası ve kargo firması girerek siparişi kargoda olarak
                  işaretleyin.
                </p>
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="cargo-tracking">Kargo takip numarası</Label>
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
                    <Label htmlFor="cargo-provider">Kargo firması</Label>
                    <Input
                      id="cargo-provider"
                      name="cargoProvider"
                      autoComplete="organization"
                      value={provider}
                      onChange={(e) => {
                        setProvider(e.target.value);
                      }}
                      disabled={!canEditCargo}
                      placeholder="Örn. Aras Kargo"
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
                    {cargoMutation.isPending ? 'Kaydediliyor…' : 'Güncelle'}
                  </Button>
                </div>
              </div>
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
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
