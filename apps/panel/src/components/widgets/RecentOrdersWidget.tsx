import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { ORDER_STATUS_I18N_KEY } from '@/lib/order-i18n';
import { orderStatusTone } from '@/lib/order-status';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Order, OrderStatus } from '@/types/order';
import { useTranslation } from 'react-i18next';

function formatTry(amount: string, currency: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(Number(amount));
}

function StatusBadge({ status }: { status: OrderStatus }): ReactElement {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={orderStatusTone(status)}>
      {t(ORDER_STATUS_I18N_KEY[status])}
    </Badge>
  );
}

export function RecentOrdersWidget(): ReactElement {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ['dashboard', 'recent-orders'],
    queryFn: async (): Promise<Order[]> => {
      const { data } = await api.get<{ items: Order[] }>('/orders', {
        params: { limit: 5, page: 1 },
      });
      return data.items;
    },
  });

  return (
    <Card
      className="h-full cursor-pointer transition-colors hover:border-accent/50"
      onClick={() => {
        navigate('/orders');
      }}
    >
      <CardHeader>
        <CardTitle>{t('dashboard.recentOrders')}</CardTitle>
        <CardDescription>{t('dashboard.recentOrdersDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {query.isError ? (
          <div className="text-sm text-destructive">
            {getApiErrorMessage(query.error)}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation();
                void query.refetch();
              }}
            >
              Tekrar dene
            </Button>
          </div>
        ) : null}
        {!query.isPending && !query.isError && (query.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Henüz sipariş yok"
            description="Siparişler bağlantı sonrası burada görünür."
          />
        ) : null}
        {!query.isPending && !query.isError && query.data && query.data.length > 0 ? (
          <ul className="divide-y">
            {query.data.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-2 py-2.5 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {getMarketplaceBranding(order.platform).label} · {order.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.platformCreatedAt.slice(0, 10)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-medium tabular-nums">
                    {formatTry(order.totalAmount, order.currency)}
                  </span>
                  <StatusBadge status={order.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
