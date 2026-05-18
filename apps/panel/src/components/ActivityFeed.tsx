import {
  AlertCircle,
  Package,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSocket } from '@/hooks/useSocket';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';

export interface ActivityItem {
  id: string;
  type: 'order' | 'sync' | 'stock' | 'error';
  message: string;
  platform?: string;
  timestamp: Date;
}

interface Props {
  maxItems?: number;
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatWsCurrency(amount: unknown): string {
  const n =
    typeof amount === 'string' || typeof amount === 'number'
      ? Number(amount)
      : Number.NaN;
  if (Number.isNaN(n)) {
    return '—';
  }
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(n);
}

function platformLabel(platform: unknown): string {
  if (typeof platform !== 'string' || platform.length === 0) {
    return 'Pazaryeri';
  }
  return getMarketplaceBranding(platform).label;
}

export function ActivityFeed({ maxItems = 20 }: Props): ReactElement {
  const { socket } = useSocket();
  const [items, setItems] = useState<ActivityItem[]>([]);

  const pushItem = useCallback(
    (item: Omit<ActivityItem, 'id' | 'timestamp'> & { timestamp?: Date }) => {
      setItems((prev) => {
        const next: ActivityItem[] = [
          {
            id: randomId(),
            timestamp: item.timestamp ?? new Date(),
            type: item.type,
            message: item.message,
            platform: item.platform,
          },
          ...prev,
        ];
        return next.slice(0, maxItems);
      });
    },
    [maxItems],
  );

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const onOrderNew = (data: unknown): void => {
      if (typeof data !== 'object' || data === null) {
        return;
      }
      const d = data as Record<string, unknown>;
      const platform = typeof d.platform === 'string' ? d.platform : '';
      const buyer =
        typeof d.buyerName === 'string' ? d.buyerName : 'Müşteri';
      const amount = formatWsCurrency(d.totalAmount);
      pushItem({
        type: 'order',
        platform,
        message: `Yeni sipariş — ${platformLabel(platform)} · ${buyer} · ${amount}`,
      });
    };

    const onSyncCompleted = (data: unknown): void => {
      if (typeof data !== 'object' || data === null) {
        return;
      }
      const d = data as Record<string, unknown>;
      const platform = typeof d.platform === 'string' ? d.platform : '';
      const orders =
        typeof d.ordersProcessed === 'number' ? d.ordersProcessed : null;
      const listings =
        typeof d.listingsProcessed === 'number' ? d.listingsProcessed : null;
      let detail = 'Senkron tamamlandı';
      if (orders !== null) {
        detail = `${orders} sipariş işlendi`;
      } else if (listings !== null) {
        detail = `${listings} listeleme güncellendi`;
      }
      pushItem({
        type: 'sync',
        platform,
        message: `${platformLabel(platform)} — ${detail}`,
      });
    };

    const onStockUpdated = (data: unknown): void => {
      if (typeof data !== 'object' || data === null) {
        return;
      }
      const d = data as Record<string, unknown>;
      const platform = typeof d.platform === 'string' ? d.platform : '';
      const barcode = typeof d.barcode === 'string' ? d.barcode : '—';
      const qty =
        typeof d.newQuantity === 'number' ? String(d.newQuantity) : '—';
      pushItem({
        type: 'stock',
        platform,
        message: `Stok güncellendi — ${platformLabel(platform)} · ${barcode} → ${qty} adet`,
      });
    };

    const onSyncError = (data: unknown): void => {
      if (typeof data !== 'object' || data === null) {
        return;
      }
      const d = data as Record<string, unknown>;
      const platform = typeof d.platform === 'string' ? d.platform : '';
      const msg = typeof d.message === 'string' ? d.message : 'Senkron hatası';
      pushItem({
        type: 'error',
        platform,
        message: `${platformLabel(platform)} — ${msg}`,
      });
    };

    socket.on('order:new', onOrderNew);
    socket.on('sync:completed', onSyncCompleted);
    socket.on('stock:updated', onStockUpdated);
    socket.on('sync:error', onSyncError);

    return (): void => {
      socket.off('order:new', onOrderNew);
      socket.off('sync:completed', onSyncCompleted);
      socket.off('stock:updated', onStockUpdated);
      socket.off('sync:error', onSyncError);
    };
  }, [socket, pushItem]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Canlı aktivite</CardTitle>
        <CardDescription>Son {maxItems} olay (WebSocket)</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Henüz canlı aktivite yok. Senkron veya yeni sipariş geldiğinde burada
            görünecek.
          </p>
        ) : (
          <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {items.map((row) => {
              const rel = formatDistanceToNow(row.timestamp, {
                addSuffix: true,
                locale: tr,
              });
              const Icon =
                row.type === 'order'
                  ? ShoppingCart
                  : row.type === 'stock'
                    ? Package
                    : row.type === 'error'
                      ? AlertCircle
                      : RefreshCw;
              const iconClass =
                row.type === 'error'
                  ? 'text-red-600'
                  : row.type === 'order'
                    ? 'text-sky-600'
                    : row.type === 'stock'
                      ? 'text-amber-600'
                      : 'text-green-600';
              return (
                <li key={row.id} className="flex gap-3 text-sm">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${iconClass}`}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug text-foreground">{row.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{rel}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
