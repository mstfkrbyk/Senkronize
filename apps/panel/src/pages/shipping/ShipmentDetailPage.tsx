import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
} from 'lucide-react';

import { CargoTrackingModal } from '@/components/shipping/CargoTrackingModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { buildCargoTrackingUrl } from '@/lib/cargo-tracking';
import {
  cargoProviderLabel,
  getCargoDisplay,
  SHIPMENT_TIMELINE_STEPS,
  trackingStatusToTimelineIndex,
} from '@/lib/cargo-display';
import { ORDER_STATUS_CONFIG, orderStatusTone } from '@/lib/order-status';
import type { CargoTrackingResult } from '@/types/shipping';
import type { Order } from '@/types/order';

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

function estimatedDeliveryLabel(order: Order, tracking?: CargoTrackingResult): string {
  if (order.status === 'DELIVERED') {
    return 'Teslim edildi';
  }
  if (tracking?.status === 'DELIVERED') {
    return 'Teslim edildi';
  }
  if (order.status !== 'SHIPPED' && !order.cargoTrackingNumber) {
    return '—';
  }
  const base = new Date(order.platformCreatedAt);
  base.setDate(base.getDate() + 3);
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(base);
}

export function ShipmentDetailPage(): ReactElement {
  const { id: orderId = '' } = useParams<{ id: string }>();
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);

  const orderQuery = useQuery({
    queryKey: ['orders', 'detail', orderId],
    enabled: orderId.length > 0,
    queryFn: async (): Promise<Order> => {
      const { data } = await api.get<Order>(`/orders/${orderId}`);
      return data;
    },
  });

  const order = orderQuery.data;
  const trackingNo = order?.cargoTrackingNumber?.trim() ?? '';
  const provider = order?.cargoProvider;

  const trackingQuery = useQuery({
    queryKey: ['cargo', 'track', 'detail', trackingNo, provider ?? ''],
    enabled: trackingNo.length > 0,
    queryFn: async (): Promise<CargoTrackingResult> => {
      const params = provider?.trim() ? { cargoProvider: provider.trim() } : undefined;
      const { data } = await api.get<CargoTrackingResult>(
        `/cargo/shipments/${encodeURIComponent(trackingNo)}`,
        { params },
      );
      return {
        ...data,
        lastUpdate:
          typeof data.lastUpdate === 'string'
            ? data.lastUpdate
            : new Date(data.lastUpdate).toISOString(),
      };
    },
  });

  usePageTitle(
    order ? `Sevkiyat · ${order.platformOrderId}` : 'Sevkiyat detayı',
  );

  const timelineIndex = useMemo(() => {
    if (trackingQuery.data) {
      return trackingStatusToTimelineIndex(trackingQuery.data.status);
    }
    if (order?.status === 'DELIVERED') {
      return 3;
    }
    if (order?.status === 'SHIPPED') {
      return 2;
    }
    if (order?.cargoTrackingNumber) {
      return 1;
    }
    return 0;
  }, [trackingQuery.data, order]);

  const externalUrl =
    trackingNo.length > 0 ? buildCargoTrackingUrl(trackingNo, provider) : '';
  const cargoMeta = getCargoDisplay(provider);
  const statusCfg = order ? ORDER_STATUS_CONFIG[order.status] : null;

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/shipping">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Kargo yönetimi
          </Link>
        </Button>
        <p className="text-destructive">
          {orderQuery.isError ? getApiErrorMessage(orderQuery.error) : 'Sipariş bulunamadı'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" asChild>
            <Link to="/shipping" aria-label="Geri">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Sevkiyat · {order.platformOrderId}
            </h1>
            <p className="text-sm text-muted-foreground">
              <Link to={`/orders/${order.id}`} className="underline-offset-4 hover:underline">
                Sipariş detayına git
              </Link>
            </p>
          </div>
        </div>
        {externalUrl ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setTrackingModalOpen(true)}>
              Panelde takip
            </Button>
            <Button type="button" asChild>
              <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                Takip et
              </a>
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sevkiyat bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Sipariş no</span>
              <span className="font-medium">{order.platformOrderId}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Müşteri</span>
              <span>{order.customerName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Adres</span>
              <span className="max-w-[240px] text-right">
                {order.shippingAddress?.trim() || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Sipariş durumu</span>
              {statusCfg ? (
                <Badge variant="outline" className={orderStatusTone(order.status)}>
                  {statusCfg.label}
                </Badge>
              ) : (
                <span>{order.status}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-2xl" aria-hidden>
                {cargoMeta.logo}
              </span>
              Kargo
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Kargo firması</span>
              <span>{cargoProviderLabel(provider ?? '')}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Takip numarası</span>
              <span className="font-mono">{trackingNo || '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Tahmini teslimat</span>
              <span>{estimatedDeliveryLabel(order, trackingQuery.data)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kargo durumu</CardTitle>
        </CardHeader>
        <CardContent>
          {trackingQuery.isPending && trackingNo.length > 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Takip bilgisi yükleniyor…
            </div>
          ) : null}

          <ol className="relative flex flex-col gap-6 sm:flex-row sm:justify-between">
            {SHIPMENT_TIMELINE_STEPS.map((step, index) => {
              const done = index <= timelineIndex;
              return (
                <li
                  key={step.key}
                  className="flex flex-1 flex-col items-center gap-2 text-center"
                >
                  {done ? (
                    <CheckCircle2
                      className="h-8 w-8 text-emerald-600"
                      aria-hidden
                    />
                  ) : (
                    <Circle className="h-8 w-8 text-muted-foreground/40" aria-hidden />
                  )}
                  <span
                    className={
                      done ? 'text-sm font-medium' : 'text-sm text-muted-foreground'
                    }
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {trackingQuery.data ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Son güncelleme: {formatDate(trackingQuery.data.lastUpdate)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {trackingNo.length > 0 ? (
        <CargoTrackingModal
          open={trackingModalOpen}
          onOpenChange={setTrackingModalOpen}
          trackingNumber={trackingNo}
          cargoProvider={provider}
        />
      ) : null}
    </div>
  );
}
