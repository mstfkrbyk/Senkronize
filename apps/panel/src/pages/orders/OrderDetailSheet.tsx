import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useErpConnections, useSyncOrderToErp } from '@/hooks/useErpConnections';
import { api, getApiErrorMessage } from '@/lib/api';
import { buildCargoTrackingUrl } from '@/lib/cargo-tracking';
import { ORDER_STATUS_LABEL_TR, orderStatusTone } from '@/lib/order-status';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Order, OrderStatus } from '@/types/order';

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
  const queryClient = useQueryClient();
  const erpConnectionsQuery = useErpConnections();
  const syncToErpMutation = useSyncOrderToErp();
  const [tracking, setTracking] = useState('');
  const [provider, setProvider] = useState('');
  const [erpConnectionId, setErpConnectionId] = useState('');

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

  return (
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
                                <img
                                  src={item.thumbnailUrl}
                                  alt=""
                                  className="h-10 w-10 rounded-md object-cover"
                                  loading="lazy"
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
  );
}
