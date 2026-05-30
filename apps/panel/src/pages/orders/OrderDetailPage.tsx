import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ExternalLink,
  FileDown,
  Loader2,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { OrderReturnDialog } from '@/components/orders/OrderReturnDialog';
import { ShipOrderModal } from '@/components/orders/ShipOrderModal';
import {
  TrackingTimeline,
  type TrackingTimelineStep,
} from '@/components/orders/TrackingTimeline';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { api, getApiErrorMessage } from '@/lib/api';
import { buildCargoTrackingUrl } from '@/lib/cargo-tracking';
import { CARGO_PROVIDER_OPTIONS, normalizeCargoProviderKey } from '@/lib/cargo-providers';
import { ORDER_STATUS_I18N_KEY } from '@/lib/order-i18n';
import { orderStatusTone } from '@/lib/order-status';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import { OrderDetailInvoiceTab } from '@/pages/orders/OrderDetailInvoiceTab';
import type { Order, OrderNote, OrderStatus } from '@/types/order';

function formatTry(amount: string | number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(Number(amount));
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
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

function buildTrackingSteps(order: Order, locale: string, t: (key: string) => string): TrackingTimelineStep[] {
  const date = formatDate(order.platformCreatedAt, locale);
  const rank = statusRank(order.status);
  const isCancelled = order.status === 'CANCELLED' || order.status === 'RETURNED';

  if (isCancelled) {
    return [
      {
        status: t('orders.detail.tracking.received'),
        date,
        done: true,
      },
      {
        status:
          order.status === 'CANCELLED'
            ? t('orders.detail.tracking.cancelled')
            : t('orders.detail.tracking.returned'),
        date,
        done: true,
      },
    ];
  }

  return [
    { status: t('orders.detail.tracking.received'), date, done: rank >= 1 },
    {
      status: t('orders.detail.tracking.preparing'),
      date: rank >= 2 ? date : '',
      done: rank >= 2,
    },
    {
      status: t('orders.detail.tracking.shipped'),
      date: rank >= 3 ? date : '',
      done: rank >= 3,
    },
    {
      status: t('orders.detail.tracking.delivered'),
      date: rank >= 4 ? date : '',
      done: rank >= 4,
    },
  ];
}

const ORDER_DETAIL_TABS = ['general', 'shipping', 'notes', 'invoice', 'documents'] as const;

export function OrderDetailPage(): ReactElement {
  const { id: orderId = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.orders'));
  const locale = i18n.language;
  const queryClient = useQueryClient();
  const tabFromUrl = searchParams.get('tab');
  const initialTab =
    tabFromUrl && ORDER_DETAIL_TABS.includes(tabFromUrl as (typeof ORDER_DETAIL_TABS)[number])
      ? tabFromUrl
      : 'general';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [noteText, setNoteText] = useState('');
  const [noteInternal, setNoteInternal] = useState(true);
  const [shipOpen, setShipOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [labelLoading, setLabelLoading] = useState(false);

  useEffect(() => {
    if (
      tabFromUrl &&
      ORDER_DETAIL_TABS.includes(tabFromUrl as (typeof ORDER_DETAIL_TABS)[number])
    ) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const detailQuery = useQuery({
    queryKey: ['orders', 'detail', orderId],
    enabled: orderId.length > 0,
    queryFn: async (): Promise<Order> => {
      const { data } = await api.get<Order>(`/orders/${orderId}`);
      return data;
    },
  });

  const order = detailQuery.data;
  usePageTitle(
    order
      ? t('orders.detail.pageTitle', { orderNo: order.platformOrderId })
      : t('orders.detail.title'),
  );

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
      toast.success(t('orders.detail.notes.added'));
      setNoteText('');
      void queryClient.invalidateQueries({ queryKey: ['orders', orderId, 'notes'] });
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
      toast.success(t('orders.detail.cancelQueued'));
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
    return buildCargoTrackingUrl(order.cargoTrackingNumber, order.cargoProvider);
  }, [order]);

  const trackingSteps = useMemo(() => {
    if (!order) {
      return [];
    }
    return buildTrackingSteps(order, locale, t);
  }, [order, locale, t]);

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

  const downloadShippingLabel = async (): Promise<void> => {
    if (!order) {
      return;
    }
    setLabelLoading(true);
    try {
      const res = await api.get(`/orders/${order.id}/shipping-label`, {
        responseType: 'blob',
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etiket-${order.platformOrderId.replace(/[^a-zA-Z0-9._-]+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('orders.detail.documents.labelDownloaded'));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLabelLoading(false);
    }
  };

  if (detailQuery.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (detailQuery.isError || !order) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            {t('orders.detail.back')}
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <QueryErrorAlert
              error={detailQuery.error}
              onRetry={() => {
                void detailQuery.refetch();
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const branding = getMarketplaceBranding(order.platform);
  const isTerminal = order.status === 'CANCELLED' || order.status === 'RETURNED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('orders.detail.heading', { orderNo: order.platformOrderId })}
        description={`${branding.label} · ${formatDate(order.platformCreatedAt, locale)}`}
        context={navContextLine}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/orders">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                {t('orders.detail.back')}
              </Link>
            </Button>
            <Badge variant="outline" className={`gap-1 ${orderStatusTone(order.status)}`}>
              {t(ORDER_STATUS_I18N_KEY[order.status])}
            </Badge>
            <span className="text-lg font-semibold tabular-nums">
              {formatTry(order.totalAmount, order.currency, locale)}
            </span>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={order.status === 'CANCELLED' || order.status === 'SHIPPED'}
          onClick={() => {
            setShipOpen(true);
          }}
        >
          <Truck className="h-4 w-4" aria-hidden />
          {t('orders.detail.actions.ship')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={order.status === 'CANCELLED' || order.status === 'RETURNED'}
          onClick={() => {
            setReturnOpen(true);
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {t('orders.detail.actions.return')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={order.status === 'CANCELLED'}
          onClick={() => {
            setCancelOpen(true);
          }}
        >
          <XCircle className="h-4 w-4" aria-hidden />
          {t('orders.detail.actions.cancel')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="general">{t('orders.detail.tabs.general')}</TabsTrigger>
          <TabsTrigger value="shipping">{t('orders.detail.tabs.shipping')}</TabsTrigger>
          <TabsTrigger value="notes">{t('orders.detail.tabs.notes')}</TabsTrigger>
          <TabsTrigger value="invoice">{t('orders.detail.tabs.invoice')}</TabsTrigger>
          <TabsTrigger value="documents">{t('orders.detail.tabs.documents')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">{t('orders.detail.summary.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('orders.orderNo')}</span>
                  <p className="mt-0.5 font-mono font-medium">{order.platformOrderId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('orders.platform')}</span>
                  <p className="mt-0.5 flex items-center gap-2 font-medium">
                    <span aria-hidden>{branding.logo}</span>
                    {branding.label}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('orders.date')}</span>
                  <p className="mt-0.5">{formatDate(order.platformCreatedAt, locale)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('orders.statusLabel')}</span>
                  <div className="mt-1">
                    <Badge variant="outline" className={orderStatusTone(order.status)}>
                      {t(ORDER_STATUS_I18N_KEY[order.status])}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('orders.amount')}</span>
                  <p className="mt-0.5 text-base font-semibold tabular-nums">
                    {formatTry(order.totalAmount, order.currency, locale)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t('orders.detail.customer.title')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{t('orders.detail.customer.name')}</span>
                  <p className="font-medium">{order.customerName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('orders.detail.customer.email')}</span>
                  <p>—</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('orders.detail.customer.phone')}</span>
                  <p>{order.customerPhone?.trim() || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">{t('orders.detail.customer.address')}</span>
                  <p className="whitespace-pre-wrap">
                    {order.shippingAddress?.trim() || '—'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('orders.detail.products.title')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14" />
                    <TableHead>{t('orders.detail.products.product')}</TableHead>
                    <TableHead className="text-right">{t('orders.detail.products.qty')}</TableHead>
                    <TableHead className="text-right">
                      {t('orders.detail.products.unitPrice')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('orders.detail.products.lineTotal')}
                    </TableHead>
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
                        <TableCell className="max-w-[280px]">
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
                          {formatTry(item.unitPrice, order.currency, locale)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatTry(lineTotal, order.currency, locale)}
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
                <span className="text-muted-foreground">{t('orders.detail.totals.subtotal')}</span>
                <span className="tabular-nums">
                  {formatTry(totals.subtotal, order.currency, locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('orders.detail.totals.shipping')}</span>
                <span className="tabular-nums">
                  {totals.shipping > 0
                    ? formatTry(totals.shipping, order.currency, locale)
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('orders.detail.totals.tax')}</span>
                <span className="tabular-nums">
                  {formatTry(totals.tax, order.currency, locale)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>{t('orders.detail.totals.grand')}</span>
                <span className="tabular-nums">
                  {formatTry(totals.total, order.currency, locale)}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('orders.detail.shipping.info')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    {t('orders.detail.shipping.provider')}
                  </span>
                  <p className="font-medium">{cargoLabel(order.cargoProvider)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t('orders.detail.shipping.trackingNo')}
                  </span>
                  <p className="font-mono">{order.cargoTrackingNumber?.trim() || '—'}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    disabled={isTerminal || order.status === 'SHIPPED'}
                    onClick={() => {
                      setShipOpen(true);
                    }}
                  >
                    <Truck className="mr-2 h-4 w-4" aria-hidden />
                    {t('orders.detail.shipping.shipButton')}
                  </Button>
                  {trackingUrl ? (
                    <Button type="button" variant="outline" asChild>
                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                        {t('orders.detail.shipping.externalTrack')}
                        <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('orders.detail.shipping.timeline')}</CardTitle>
              </CardHeader>
              <CardContent>
                <TrackingTimeline steps={trackingSteps} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('orders.detail.notes.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notesQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                  {(notesQuery.data ?? []).length === 0 ? (
                    <li className="text-muted-foreground">{t('orders.detail.notes.empty')}</li>
                  ) : (
                    (notesQuery.data ?? []).map((n) => (
                      <li
                        key={n.id}
                        className="rounded-md border bg-muted/30 px-3 py-2 dark:bg-muted/20"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{n.userName}</span>
                          <span>·</span>
                          <span>{formatDate(n.createdAt, locale)}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {n.isInternal
                              ? t('orders.detail.notes.internal')
                              : t('orders.detail.notes.customer')}
                          </Badge>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{n.content}</p>
                      </li>
                    ))
                  )}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="note-internal"
                  checked={noteInternal}
                  onCheckedChange={(v) => {
                    setNoteInternal(v === true);
                  }}
                />
                <Label htmlFor="note-internal" className="text-sm font-normal">
                  {t('orders.detail.notes.internal')}
                </Label>
              </div>
              <Textarea
                rows={3}
                value={noteText}
                placeholder={t('orders.detail.notes.placeholder')}
                onChange={(e) => {
                  setNoteText(e.target.value);
                }}
              />
              <Button
                type="button"
                disabled={addNoteMutation.isPending || noteText.trim().length === 0}
                onClick={() => {
                  addNoteMutation.mutate();
                }}
              >
                {t('orders.detail.notes.add')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoice" className="mt-4">
          <OrderDetailInvoiceTab orderId={orderId} order={order} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('orders.detail.documents.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                {t('orders.detail.documents.labelHint')}
              </p>
              <Button
                type="button"
                variant="outline"
                className="gap-1"
                disabled={labelLoading}
                onClick={() => {
                  void downloadShippingLabel();
                }}
              >
                {labelLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileDown className="h-4 w-4" aria-hidden />
                )}
                {t('orders.detail.documents.downloadLabel')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ShipOrderModal
        open={shipOpen}
        onOpenChange={setShipOpen}
        order={order}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] });
        }}
      />

      <OrderReturnDialog
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
            <DialogTitle>{t('orders.detail.cancelTitle')}</DialogTitle>
            <DialogDescription>{t('orders.detail.cancelDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="cancel-reason">{t('orders.detail.cancelReason')}</Label>
            <Input
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
              }}
              placeholder={t('orders.detail.cancelReasonPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              {t('common.cancel')}
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
              {t('orders.detail.actions.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
