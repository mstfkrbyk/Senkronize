import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileDown,
  FileText,
  Loader2,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { ReturnCreateModal } from '@/components/orders/ReturnCreateModal';
import { ShipOrderModal } from '@/components/orders/ShipOrderModal';
import { CargoTrackingModal } from '@/components/shipping/CargoTrackingModal';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { CARGO_PROVIDER_OPTIONS, normalizeCargoProviderKey } from '@/lib/cargo-providers';
import { getTrackingUrl } from '@/lib/cargo-tracking';
import { ORDER_STATUS_CONFIG, orderStatusTone } from '@/lib/order-status';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Order, OrderNote, OrderStatus } from '@/types/order';

const STATUS_TIMELINE: readonly {
  status: OrderStatus;
  label: string;
}[] = [
  { status: 'NEW', label: 'Yeni sipariş' },
  { status: 'PICKING', label: 'İşlemde' },
  { status: 'SHIPPED', label: 'Kargoya verildi' },
  { status: 'DELIVERED', label: 'Teslim edildi' },
];

function statusRank(status: OrderStatus): number {
  switch (status) {
    case 'DELIVERED':
      return 4;
    case 'SHIPPED':
      return 3;
    case 'INVOICED':
    case 'PICKING':
      return 2;
    case 'NEW':
    default:
      return 1;
  }
}

function formatTry(amount: string | number, currency: string): string {
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

function cargoLabel(provider: string | null | undefined): string {
  if (!provider?.trim()) {
    return '—';
  }
  const key = normalizeCargoProviderKey(provider);
  const found = CARGO_PROVIDER_OPTIONS.find((o) => o.value === key);
  return found?.label ?? provider;
}

function estimatedDeliveryDate(order: Order): string {
  if (order.status === 'DELIVERED') {
    return 'Teslim edildi';
  }
  if (order.status !== 'SHIPPED') {
    return '—';
  }
  const base = new Date(order.platformCreatedAt);
  base.setDate(base.getDate() + 3);
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(base);
}

export function OrderDetailPage(): ReactElement {
  const { id: orderId = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [noteInternal, setNoteInternal] = useState(true);
  const [shipOpen, setShipOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cargoTrackingOpen, setCargoTrackingOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['orders', 'detail', orderId],
    enabled: orderId.length > 0,
    queryFn: async (): Promise<Order> => {
      const { data } = await api.get<Order>(`/orders/${orderId}`);
      return data;
    },
  });

  const order = detailQuery.data;
  usePageTitle(order ? `Sipariş ${order.platformOrderId}` : 'Sipariş detayı');

  const notesQuery = useQuery({
    queryKey: ['orders', orderId, 'notes'],
    enabled: orderId.length > 0,
    queryFn: async (): Promise<OrderNote[]> => {
      const { data } = await api.get<OrderNote[]>(`/orders/${orderId}/notes`);
      return data;
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (): Promise<OrderNote> => {
      const { data } = await api.post<OrderNote>(`/orders/${orderId}/notes`, {
        content: noteText.trim(),
        isInternal: noteInternal,
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Not eklendi');
      setNoteText('');
      void queryClient.invalidateQueries({ queryKey: ['orders', orderId, 'notes'] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const invoicePdfMutation = useMutation({
    mutationFn: async (): Promise<Blob> => {
      const res = await api.get(`/invoices/order/${orderId}`, { responseType: 'blob' });
      return res.data as Blob;
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatura-${order?.platformOrderId ?? orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Fatura PDF indirildi');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post(`/invoices/from-order/${orderId}`);
    },
    onSuccess: () => {
      toast.success('Fatura oluşturuldu');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post(`/orders/${orderId}/cancel`, {
        reason: cancelReason.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('İptal işlemi kuyruğa alındı');
      setCancelOpen(false);
      setCancelReason('');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const trackingUrl = useMemo(() => {
    if (!order?.cargoTrackingNumber?.trim()) {
      return '';
    }
    const url = getTrackingUrl(order.cargoProvider ?? '', order.cargoTrackingNumber);
    return url !== '#' ? url : '';
  }, [order]);

  const currentRank = order ? statusRank(order.status) : 0;

  const totals = useMemo(() => {
    if (!order) {
      return { subtotal: 0, shipping: 0, tax: 0, total: 0 };
    }
    const subtotal = order.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );
    const total = Number(order.totalAmount);
    const diff = Math.max(0, total - subtotal);
    const tax = Math.round(subtotal * 0.2 * 100) / 100;
    const shipping = Math.max(0, diff - tax);
    return { subtotal, shipping, tax, total };
  }, [order]);

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-96 lg:col-span-3" />
          <Skeleton className="h-96 lg:col-span-6" />
          <Skeleton className="h-96 lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !order) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Siparişlere dön
          </Link>
        </Button>
        <p className="text-sm text-destructive">{getApiErrorMessage(detailQuery.error)}</p>
      </div>
    );
  }

  const branding = getMarketplaceBranding(order.platform);
  const statusConfig = ORDER_STATUS_CONFIG[order.status];
  const isTerminal = order.status === 'CANCELLED' || order.status === 'RETURNED';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Siparişler
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sipariş {order.platformOrderId}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sol panel — sipariş bilgileri */}
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sipariş bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Sipariş no</span>
                <p className="mt-0.5 font-mono font-medium">{order.platformOrderId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Platform</span>
                <p className="mt-0.5 flex items-center gap-2 font-medium">
                  <span aria-hidden>{branding.logo}</span>
                  {branding.label}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Tarih</span>
                <p className="mt-0.5">{formatDate(order.platformCreatedAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Durum</span>
                <div className="mt-1">
                  <Badge variant="outline" className={`gap-1 ${orderStatusTone(order.status)}`}>
                    {statusConfig?.label ?? order.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Durum geçmişi</CardTitle>
            </CardHeader>
            <CardContent>
              {isTerminal ? (
                <p className="text-sm text-muted-foreground">
                  {order.status === 'CANCELLED' ? 'Sipariş iptal edildi.' : 'Sipariş iade edildi.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {STATUS_TIMELINE.map((step) => {
                    const stepRank =
                      step.status === 'NEW'
                        ? 1
                        : step.status === 'PICKING'
                          ? 2
                          : step.status === 'SHIPPED'
                            ? 3
                            : 4;
                    const done = currentRank >= stepRank;
                    const Icon = done ? CheckCircle2 : Circle;
                    return (
                      <li key={step.status} className="flex gap-3">
                        <Icon
                          className={
                            done
                              ? 'mt-0.5 h-4 w-4 shrink-0 text-green-600'
                              : 'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground'
                          }
                          aria-hidden
                        />
                        <div>
                          <p className={done ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>
                            {step.label}
                          </p>
                          {done ? (
                            <p className="text-xs text-muted-foreground">
                              {formatDate(order.platformCreatedAt)}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kargo bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Kargo firması</span>
                <p className="font-medium">{cargoLabel(order.cargoProvider)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Takip numarası</span>
                <p className="font-mono">{order.cargoTrackingNumber?.trim() || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tahmini teslimat</span>
                <p>{estimatedDeliveryDate(order)}</p>
              </div>
              {order.cargoTrackingNumber?.trim() ? (
                <div className="mt-2 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setCargoTrackingOpen(true)}
                  >
                    Kargo durumu
                  </Button>
                  {trackingUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-1"
                      asChild
                    >
                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                        Kargo firmasında aç
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Orta — ürünler */}
        <div className="space-y-4 lg:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ürünler</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14" />
                    <TableHead>Ürün</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">Birim fiyat</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => {
                    const lineTotal = Number(item.unitPrice) * item.quantity;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="p-2">
                          {item.thumbnailUrl ? (
                            <ProductImage
                              src={item.thumbnailUrl}
                              alt=""
                              size={40}
                              className="h-10 w-10 rounded-md"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                              —
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <p className="truncate font-medium">
                            {item.productName ?? item.sku}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            SKU: {item.sku}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(item.unitPrice, order.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatTry(lineTotal, order.currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 pt-6 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alt toplam</span>
                <span className="tabular-nums">{formatTry(totals.subtotal, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kargo ücreti</span>
                <span className="tabular-nums">
                  {totals.shipping > 0
                    ? formatTry(totals.shipping, order.currency)
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">KDV (%20, tahmini)</span>
                <span className="tabular-nums">{formatTry(totals.tax, order.currency)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Genel toplam</span>
                <span className="tabular-nums">{formatTry(totals.total, order.currency)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ panel — müşteri & işlemler */}
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Müşteri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Ad</span>
                <p className="font-medium">{order.customerName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">E-posta</span>
                <p>—</p>
              </div>
              <div>
                <span className="text-muted-foreground">Telefon</span>
                <p>{order.customerPhone?.trim() || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Adres</span>
                <p className="whitespace-pre-wrap">
                  {order.shippingAddress?.trim() || '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dahili notlar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notesQuery.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
                  {(notesQuery.data ?? []).length === 0 ? (
                    <li className="text-muted-foreground">Henüz not yok</li>
                  ) : (
                    (notesQuery.data ?? []).map((n) => (
                      <li
                        key={n.id}
                        className="rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{n.userName}</span>
                          <span>·</span>
                          <span>{formatDate(n.createdAt)}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {n.isInternal ? 'İç' : 'Müşteri'}
                          </Badge>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{n.content}</p>
                      </li>
                    ))
                  )}
                </ul>
              )}
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="note-internal" className="text-sm">
                  İç not
                </Label>
                <Switch
                  id="note-internal"
                  checked={noteInternal}
                  onCheckedChange={setNoteInternal}
                />
              </div>
              <Textarea
                rows={3}
                value={noteText}
                placeholder="Yeni not yazın…"
                onChange={(e) => {
                  setNoteText(e.target.value);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={addNoteMutation.isPending || noteText.trim().length === 0}
                onClick={() => {
                  addNoteMutation.mutate();
                }}
              >
                Not ekle
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hızlı aksiyonlar</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button
                type="button"
                className="w-full justify-start gap-2"
                variant="outline"
                disabled={order.status === 'CANCELLED' || order.status === 'SHIPPED'}
                onClick={() => {
                  setShipOpen(true);
                }}
              >
                <Truck className="h-4 w-4" aria-hidden />
                Kargo ver
              </Button>
              <Button
                type="button"
                className="w-full justify-start gap-2"
                variant="outline"
                disabled={order.status === 'CANCELLED'}
                onClick={() => {
                  setCancelOpen(true);
                }}
              >
                <XCircle className="h-4 w-4" aria-hidden />
                İptal et
              </Button>
              <Button
                type="button"
                className="w-full justify-start gap-2"
                variant="outline"
                disabled={order.status === 'CANCELLED' || order.status === 'RETURNED'}
                onClick={() => {
                  setReturnOpen(true);
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                İade oluştur
              </Button>
              <Button
                type="button"
                className="w-full justify-start gap-2"
                variant="outline"
                disabled={createInvoiceMutation.isPending}
                onClick={() => {
                  createInvoiceMutation.mutate();
                }}
              >
                {createInvoiceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden />
                )}
                Fatura oluştur
              </Button>
              <Button
                type="button"
                className="w-full justify-start gap-2"
                variant="outline"
                disabled={invoicePdfMutation.isPending}
                onClick={() => {
                  invoicePdfMutation.mutate();
                }}
              >
                {invoicePdfMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileDown className="h-4 w-4" aria-hidden />
                )}
                Fatura indir (PDF)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ShipOrderModal
        open={shipOpen}
        onOpenChange={setShipOpen}
        order={order}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] });
        }}
      />

      <ReturnCreateModal
        open={returnOpen}
        onOpenChange={setReturnOpen}
        order={order}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] });
        }}
      />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Siparişi iptal et</DialogTitle>
            <DialogDescription>
              İptal işlemi platforma iletilir ve stok güncellenir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="cancel-reason">İptal nedeni (opsiyonel)</Label>
            <Input
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
              }}
              placeholder="Müşteri talebi…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => {
                cancelMutation.mutate();
              }}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              İptal et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {order?.cargoTrackingNumber?.trim() ? (
        <CargoTrackingModal
          open={cargoTrackingOpen}
          onOpenChange={setCargoTrackingOpen}
          trackingNumber={order.cargoTrackingNumber}
          cargoProvider={order.cargoProvider}
        />
      ) : null}
    </div>
  );
}
