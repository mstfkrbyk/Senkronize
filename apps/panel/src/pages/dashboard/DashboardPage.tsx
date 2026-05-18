import type { LucideIcon } from 'lucide-react';
import {
  ClipboardList,
  Clock,
  Package,
  Plug,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getApiErrorMessage } from '@/lib/api';
import { ORDER_STATUS_LABEL_TR, orderStatusTone } from '@/lib/order-status';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import { useListingSummary } from '@/pages/listings/hooks/useListings';
import { useOrderSummary } from '@/pages/orders/hooks/useOrders';
import type { MarketplaceConnectionDto } from '@/types/connection';
import type { Order, OrderStatus } from '@/types/order';
import type { SyncStatusItem } from '@/types/sync';

const KPI_CARDS: {
  title: string;
  key:
    | 'todayOrders'
    | 'pendingOrders'
    | 'totalRevenue'
    | 'activeListings'
    | 'connections';
  icon: LucideIcon;
  color: 'blue' | 'orange' | 'green' | 'sky' | 'purple';
}[] = [
  {
    title: 'Bugünkü Siparişler',
    key: 'todayOrders',
    icon: ShoppingCart,
    color: 'blue',
  },
  {
    title: 'Bekleyen Siparişler',
    key: 'pendingOrders',
    icon: Clock,
    color: 'orange',
  },
  {
    title: 'Toplam Ciro',
    key: 'totalRevenue',
    icon: Package,
    color: 'green',
  },
  {
    title: 'Aktif listeler',
    key: 'activeListings',
    icon: ClipboardList,
    color: 'sky',
  },
  {
    title: 'Entegrasyonlar',
    key: 'connections',
    icon: Plug,
    color: 'purple',
  },
];

const MOCK_WEEKLY = [
  { gun: 'Pzt', siparis: 12 },
  { gun: 'Sal', siparis: 18 },
  { gun: 'Çrş', siparis: 9 },
  { gun: 'Prş', siparis: 24 },
  { gun: 'Cum', siparis: 31 },
  { gun: 'Cmt', siparis: 15 },
  { gun: 'Paz', siparis: 7 },
] as const;

const KPI_COLOR: Record<
  (typeof KPI_CARDS)[number]['color'],
  { ring: string; icon: string }
> = {
  blue: { ring: 'ring-blue-100', icon: 'text-blue-600' },
  orange: { ring: 'ring-orange-100', icon: 'text-orange-600' },
  green: { ring: 'ring-green-100', icon: 'text-green-600' },
  sky: { ring: 'ring-sky-100', icon: 'text-sky-600' },
  purple: { ring: 'ring-purple-100', icon: 'text-purple-600' },
};

interface SalesReportRow {
  period: string;
  totalOrders: number;
  totalRevenue: number;
  byPlatform: Record<string, number>;
}

function last7DayKeys(): { iso: string; label: string }[] {
  const res: { iso: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0] ?? '';
    res.push({
      iso,
      label: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
    });
  }
  return res;
}

function chartFromSalesReport(
  rows: SalesReportRow[] | undefined,
): { gun: string; siparis: number }[] {
  const keys = last7DayKeys();
  const periodMap = new Map(
    (rows ?? []).map((r) => [r.period.slice(0, 10), r.totalOrders]),
  );
  return keys.map(({ iso, label }) => ({
    gun: label,
    siparis: periodMap.get(iso) ?? 0,
  }));
}

function RecentOrderStatusBadge({
  status,
}: {
  status: OrderStatus;
}): ReactElement {
  return (
    <Badge variant="outline" className={orderStatusTone(status)}>
      {ORDER_STATUS_LABEL_TR[status]}
    </Badge>
  );
}

function SyncStatusBadge({
  status,
}: {
  status: SyncStatusItem['status'];
}): ReactElement {
  const label: Record<SyncStatusItem['status'], string> = {
    healthy: 'Sağlıklı',
    warning: 'Uyarı',
    error: 'Hata',
  };
  const tone: Record<SyncStatusItem['status'], string> = {
    healthy: 'border-green-200 bg-green-50 text-green-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
  };
  return (
    <Badge variant="outline" className={tone[status]}>
      {label[status]}
    </Badge>
  );
}

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount);
}

function formatTryFromString(amount: string, currency: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(Number(amount));
}

export function DashboardPage(): ReactElement {
  const orderSummaryQuery = useOrderSummary();
  const listingSummaryQuery = useListingSummary();

  const connectionsCountQuery = useQuery({
    queryKey: ['marketplace-connections', 'count'],
    queryFn: async (): Promise<number> => {
      const { data } = await api.get<
        | MarketplaceConnectionDto[]
        | { items: MarketplaceConnectionDto[]; total: number }
      >('/marketplace-connections');
      if (Array.isArray(data)) {
        return data.length;
      }
      return data.total;
    },
    initialData: 0,
  });

  const recentOrdersQuery = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: async (): Promise<Order[]> => {
      const { data } = await api.get<{ items: Order[]; total: number }>(
        '/orders',
        { params: { limit: 5, page: 1 } },
      );
      return data.items;
    },
  });

  const weeklySalesQuery = useQuery({
    queryKey: ['reports', 'sales', 'weekly'],
    queryFn: async (): Promise<SalesReportRow[]> => {
      const end = new Date().toISOString().split('T')[0] ?? '';
      const start = new Date(Date.now() - 7 * 86_400_000)
        .toISOString()
        .split('T')[0] ?? '';
      const { data } = await api.get<SalesReportRow[]>('/reports/sales', {
        params: { startDate: start, endDate: end, groupBy: 'day' },
      });
      return data;
    },
  });

  const syncQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: async (): Promise<SyncStatusItem[]> => {
      const { data } = await api.get<SyncStatusItem[]>('/sync/status');
      return data;
    },
  });

  const handleMockSyncTrigger = (): void => {
    toast.info('Senkron kuyruğu tetikleme yakında aktif olacak.');
  };

  const chartData =
    weeklySalesQuery.isError || weeklySalesQuery.isPending
      ? [...MOCK_WEEKLY]
      : chartFromSalesReport(weeklySalesQuery.data);

  const recentOrders = recentOrdersQuery.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Özet
        </h1>
        <p className="text-muted-foreground">
          Günlük operasyonlarınızın genel görünümü.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          const colors = KPI_COLOR[kpi.color];
          const isOrderMetric =
            kpi.key === 'todayOrders' ||
            kpi.key === 'pendingOrders' ||
            kpi.key === 'totalRevenue';
          const isListingMetric = kpi.key === 'activeListings';
          const isConnectionsMetric = kpi.key === 'connections';
          const isLoadingKpi =
            (isOrderMetric && orderSummaryQuery.isLoading) ||
            (isListingMetric && listingSummaryQuery.isLoading) ||
            (isConnectionsMetric && connectionsCountQuery.isLoading);
          let value: string | number = '—';
          if (kpi.key === 'connections') {
            value = connectionsCountQuery.data ?? 0;
          } else if (kpi.key === 'activeListings') {
            value = listingSummaryQuery.data?.approved ?? '—';
          } else if (orderSummaryQuery.data) {
            value =
              kpi.key === 'totalRevenue'
                ? formatTry(orderSummaryQuery.data.totalRevenue)
                : orderSummaryQuery.data[kpi.key];
          }
          return (
            <Card key={kpi.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {kpi.title}
                </CardTitle>
                <div
                  className={`rounded-full p-2 ring-2 ${colors.ring} bg-background`}
                >
                  <Icon className={`h-4 w-4 ${colors.icon}`} aria-hidden />
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingKpi ? (
                  <Skeleton className="h-9 w-24" />
                ) : (
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Haftalık siparişler</CardTitle>
          <CardDescription>
            {weeklySalesQuery.isError || weeklySalesQuery.isPending
              ? 'Son 7 gün (örnek veri — rapor yüklenemedi veya bekleniyor)'
              : 'Son 7 gün (günlük rapor)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="gun" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                }}
              />
              <Bar dataKey="siparis" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Son siparişler</CardTitle>
            <CardDescription>Son 5 sipariş</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {recentOrdersQuery.isPending ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : null}
            {recentOrdersQuery.isError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {getApiErrorMessage(recentOrdersQuery.error)}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    void recentOrdersQuery.refetch();
                  }}
                >
                  Tekrar dene
                </Button>
              </div>
            ) : null}
            {!recentOrdersQuery.isPending &&
            !recentOrdersQuery.isError &&
            recentOrders.length === 0 ? (
              <EmptyState
                title="Henüz sipariş yok"
                description="Pazaryeri siparişleri çekildiğinde burada listelenecek."
              />
            ) : null}
            {!recentOrdersQuery.isPending &&
            !recentOrdersQuery.isError &&
            recentOrders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pazaryeri</TableHead>
                    <TableHead>Müşteri</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tarih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {getMarketplaceBranding(order.platform).label}
                      </TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTryFromString(order.totalAmount, order.currency)}
                      </TableCell>
                      <TableCell>
                        <RecentOrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.platformCreatedAt.slice(0, 10)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Senkron durumu</CardTitle>
              <CardDescription>Canlı entegrasyon sağlığı</CardDescription>
            </div>
            {syncQuery.isFetching ? (
              <RefreshCw
                className="h-4 w-4 animate-spin text-muted-foreground"
                aria-hidden
              />
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {syncQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : null}

            {syncQuery.isError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {getApiErrorMessage(syncQuery.error)}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    void syncQuery.refetch();
                  }}
                >
                  Tekrar dene
                </Button>
              </div>
            ) : null}

            {!syncQuery.isLoading &&
            !syncQuery.isError &&
            (syncQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="Henüz entegrasyon yok"
                description="Pazaryeri bağlantısı eklediğinizde senkron durumu burada görünür."
              />
            ) : null}

            {!syncQuery.isLoading &&
            !syncQuery.isError &&
            syncQuery.data &&
            syncQuery.data.length > 0
              ? syncQuery.data.map((row) => {
                  const branding = getMarketplaceBranding(row.platform);
                  const last = row.lastSuccessAt
                    ? formatDistanceToNow(new Date(row.lastSuccessAt), {
                        addSuffix: true,
                        locale: tr,
                      })
                    : 'Henüz senkron yok';
                  return (
                    <div
                      key={row.platform}
                      className="rounded-lg border bg-muted/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            <span className="mr-2" aria-hidden>
                              {branding.logo}
                            </span>
                            {branding.label}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Son senkron: {last}
                          </p>
                          {row.errorCount > 0 ? (
                            <p className="mt-1 text-xs text-amber-700">
                              {row.errorCount} hata kaydı
                            </p>
                          ) : null}
                        </div>
                        <SyncStatusBadge status={row.status} />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="mt-3 w-full"
                        onClick={() => {
                          handleMockSyncTrigger();
                        }}
                      >
                        Sync Et
                      </Button>
                    </div>
                  );
                })
              : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
