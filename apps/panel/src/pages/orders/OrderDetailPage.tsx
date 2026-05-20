import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileDown,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { CARGO_PROVIDER_OPTIONS, normalizeCargoProviderKey } from '@/lib/cargo-providers';
import { getTrackingUrl } from '@/lib/cargo-tracking';
import { ORDER_STATUS_LABEL_TR, orderStatusTone } from '@/lib/order-status';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { CargoProvider } from '@senkronize/shared';
import type { Order, OrderNote, OrderStatus } from '@/types/order';

const TIMELINE_STEPS: readonly {
  key: string;
  label: string;
  minRank: number;
}[] = [
  { key: 'created', label: 'Sipariş oluşturuldu', minRank: 0 },
  { key: 'paid', label: 'Ödendi', minRank: 1 },
  { key: 'shipped', label: 'Kargoya verildi', minRank: 2 },
  { key: 'delivered', label: 'Teslim edildi', minRank: 3 },
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

export function OrderDetailPage(): ReactElement {
  const { id: orderId = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tracking, setTracking] = useState('');
  const [cargoProvider, setCargoProvider] = useState<CargoProvider | ''>('');
  const [noteText, setNoteText] = useState('');
  const [noteInternal, setNoteInternal] = useState(true);

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

  useEffect(() => {
    if (!order) {
      return;
    }
    setTracking(order.cargoTrackingNumber ?? '');
    setCargoProvider(normalizeCargoProviderKey(order.cargoProvider) ?? '');
  }, [order]);

  const trackingMutation = useMutation({
    mutationFn: async (): Promise<Order> => {
      if (!cargoProvider) {
        throw new Error('Kargo firması seçin');
      }
      const { data } = await api.patch<Order>(`/orders/${orderId}/tracking`, {
        trackingNumber: tracking.trim(),
        cargoProvider,
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Kargo bilgisi kaydedildi');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
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

  const trackingUrl = useMemo(() => {
    if (!order?.cargoTrackingNumber?.trim()) {
      return '';
    }
    const providerKey = cargoProvider || order.cargoProvider || '';
    const url = getTrackingUrl(providerKey, order.cargoTrackingNumber);
    return url !== '#' ? url : '';
  }, [order, cargoProvider]);

  const currentRank = order ? statusRank(order.status) : 0;
  const lineTotal = (item: Order['items'][number]): number =>
    Number(item.unitPrice) * item.quantity;

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
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
        <Badge variant="outline" className={orderStatusTone(order.status)}>
          {ORDER_STATUS_LABEL_TR[order.status]}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sipariş bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Platform</span>
                <p className="mt-0.5 flex items-center gap-2 font-medium">
                  <span aria-hidden>{branding.logo}</span>
                  {branding.label}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Sipariş no</span>
                <p className="mt-0.5 font-mono">{order.platformOrderId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tarih</span>
                <p className="mt-0.5">{formatDate(order.platformCreatedAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Toplam</span>
                <p className="mt-0.5 font-semibold">
                  {formatTry(order.totalAmount, order.currency)}
                </p>
              </div>
            </CardContent>
          </Card>

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
                    <TableHead className="text-right">Miktar</TableHead>
                    <TableHead className="text-right">Birim fiyat</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
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
                      <TableCell className="max-w-[200px]">
                        <p className="truncate font-medium">
                          {item.productName ?? item.sku}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {item.barcode}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTry(item.unitPrice, order.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatTry(String(lineTotal(item)), order.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kargo bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cargo-provider">Kargo şirketi</Label>
                  <Select
                    value={cargoProvider || undefined}
                    onValueChange={(v) => {
                      setCargoProvider(v as CargoProvider);
                    }}
                  >
                    <SelectTrigger id="cargo-provider">
                      <SelectValue placeholder="Firma seçin" />
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
                <div className="space-y-2">
                  <Label htmlFor="cargo-tracking">Takip numarası</Label>
                  <Input
                    id="cargo-tracking"
                    value={tracking}
                    onChange={(e) => {
                      setTracking(e.target.value);
                    }}
                    placeholder="Takip numarası"
                  />
                </div>
              </div>
              <Button
                type="button"
                disabled={
                  trackingMutation.isPending ||
                  !cargoProvider ||
                  tracking.trim().length === 0
                }
                onClick={() => {
                  trackingMutation.mutate();
                }}
              >
                {trackingMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Kaydet
              </Button>
              {tracking.trim().length > 0 && trackingUrl ? (
                <p className="text-sm">
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-600 underline-offset-4 hover:underline"
                  >
                    Kargo takip sayfasını aç
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Müşteri bilgileri</CardTitle>
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
              <CardTitle className="text-base">Notlar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <p className="text-xs text-muted-foreground">
                {noteInternal
                  ? 'İç not — yalnızca ekip görür.'
                  : 'Müşteri notu — operasyon kaydı.'}
              </p>
              {notesQuery.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
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
                disabled={
                  addNoteMutation.isPending || noteText.trim().length === 0
                }
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
              <CardTitle className="text-base">Fatura</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full gap-2"
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
                Fatura PDF
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zaman çizelgesi</CardTitle>
            </CardHeader>
            <CardContent>
              {['CANCELLED', 'RETURNED'].includes(order.status) ? (
                <p className="text-sm text-muted-foreground">
                  Bu sipariş için zaman çizelgesi gösterilmez (
                  {ORDER_STATUS_LABEL_TR[order.status]}).
                </p>
              ) : (
                <ul className="space-y-3">
                  {TIMELINE_STEPS.map((step, idx) => {
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
                        <p
                          className={
                            done
                              ? 'text-sm font-medium'
                              : 'text-sm text-muted-foreground'
                          }
                        >
                          {idx + 1}. {step.label}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
