import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Package,
  Plug,
  PlugZap,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

import { ActivityFeed } from '@/components/ActivityFeed';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
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
import { useTriggerManualSync } from '@/hooks/useConnections';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSocket } from '@/hooks/useSocket';
import { api, getApiErrorMessage } from '@/lib/api';
import { ORDER_STATUS_LABEL_TR, orderStatusTone } from '@/lib/order-status';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { DashboardSummaryDto } from '@/types/dashboard-summary';
import type { Order, OrderStatus } from '@/types/order';
import type { SyncStatusItem } from '@/types/sync';

const MOCK_WEEKLY = [
  { gun: 'Pzt', siparis: 12 },
  { gun: 'Sal', siparis: 18 },
  { gun: 'Çrş', siparis: 9 },
  { gun: 'Prş', siparis: 24 },
  { gun: 'Cum', siparis: 31 },
  { gun: 'Cmt', siparis: 15 },
  { gun: 'Paz', siparis: 7 },
] as const;

const KPI_ICON: Record<
  'blue' | 'orange' | 'green' | 'sky' | 'purple',
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
    healthy: 'Aktif',
    warning: 'Yavaş',
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

function formatTryFromString(amount: string, currency: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(Number(amount));
}

function pendingOrdersTone(count: number): string {
  if (count === 0) {
    return 'text-green-600';
  }
  if (count <= 5) {
    return 'text-amber-600';
  }
  return 'text-red-600';
}

export function DashboardPage(): ReactElement {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const triggerSyncMutation = useTriggerManualSync();
  const [kpiPeriod, setKpiPeriod] = useState<
    'default' | '24h' | '7d' | 'month'
  >('default');

  const dashboardSummaryQuery = useQuery({
    queryKey: ['reports', 'dashboard-summary', kpiPeriod],
    queryFn: async (): Promise<DashboardSummaryDto> => {
      const { data } = await api.get<DashboardSummaryDto>(
        '/reports/dashboard-summary',
        { params: { period: kpiPeriod } },
      );
      return data;
    },
    staleTime: 60_000,
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

  const chartData =
    weeklySalesQuery.isError || weeklySalesQuery.isPending
      ? [...MOCK_WEEKLY]
      : chartFromSalesReport(weeklySalesQuery.data);

  const recentOrders = recentOrdersQuery.data ?? [];
  const dash = dashboardSummaryQuery.data;
  const kpiLoading = dashboardSummaryQuery.isPending;

  const ordersCardTitle =
    kpiPeriod === 'default'
      ? 'Bugünkü siparişler'
      : kpiPeriod === '24h'
        ? 'Son 24 saat — sipariş'
        : kpiPeriod === '7d'
          ? 'Son 7 gün — sipariş'
          : 'Bu ay — sipariş';

  const ordersCount =
    kpiPeriod === 'default' ? dash?.todayOrders : dash?.windowOrders;
  const ordersDeltaPct =
    kpiPeriod === 'default' ? dash?.todayOrdersDelta : dash?.windowOrdersDeltaPct;
  const ordersDeltaCaption =
    kpiPeriod === 'default' ? 'düne göre' : 'önceki döneme göre';

  useEffect(() => {
    if (!socket) {
      return undefined;
    }
    const onOrderNew = (data: unknown): void => {
      void queryClient.invalidateQueries({
        queryKey: ['reports', 'dashboard-summary'],
      });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'recent'] });
      void queryClient.invalidateQueries({
        queryKey: ['reports', 'sales', 'weekly'],
      });
      let description = 'Yeni sipariş alındı.';
      if (typeof data === 'object' && data !== null) {
        const d = data as Record<string, unknown>;
        const buyer =
          typeof d.buyerName === 'string' ? d.buyerName : 'Müşteri';
        const platform =
          typeof d.platform === 'string' ? d.platform : 'Pazaryeri';
        const amt = d.totalAmount;
        const amountStr =
          typeof amt === 'string' || typeof amt === 'number'
            ? new Intl.NumberFormat('tr-TR', {
                style: 'currency',
                currency: 'TRY',
              }).format(Number(amt))
            : '—';
        description = `${buyer} · ${amountStr}`;
        toast.success(`Yeni sipariş — ${getMarketplaceBranding(platform).label}`, {
          description,
          duration: 5000,
        });
        return;
      }
      toast.success('Yeni sipariş', { description, duration: 5000 });
    };
    const onSyncCompleted = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({
        queryKey: ['marketplace-connections'],
      });
    };
    const onStockUpdated = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({ queryKey: ['stock'] });
    };
    socket.on('order:new', onOrderNew);
    socket.on('sync:completed', onSyncCompleted);
    socket.on('stock:updated', onStockUpdated);
    return (): void => {
      socket.off('order:new', onOrderNew);
      socket.off('sync:completed', onSyncCompleted);
      socket.off('stock:updated', onStockUpdated);
    };
  }, [socket, queryClient]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Özet
          </h1>
          <p className="text-muted-foreground">
            Günlük operasyonlarınızın genel görünümü.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'default' as const, label: 'Bugün' },
              { id: '24h' as const, label: 'Son 24 Saat' },
              { id: '7d' as const, label: 'Son 7 Gün' },
              { id: 'month' as const, label: 'Bu Ay' },
            ] as const
          ).map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={kpiPeriod === p.id ? 'default' : 'outline'}
              onClick={() => {
                setKpiPeriod(p.id);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {!dashboardSummaryQuery.isPending &&
      !dashboardSummaryQuery.isError &&
      dash &&
      dash.totalConnections === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="pt-8 pb-8">
            <EmptyState
              iconNode={
                <PlugZap
                  className="h-16 w-16 text-muted-foreground"
                  aria-hidden
                />
              }
              title="Henüz bağlantı yok"
              description="Pazaryeri veya e-ticaret mağazanızı bağlayarak başlayın."
              actionSlot={
                <Button
                  type="button"
                  onClick={() => {
                    navigate('/connections');
                  }}
                >
                  İlk Bağlantıyı Ekle
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {ordersCardTitle}
            </CardTitle>
            <div
              className={`rounded-full p-2 ring-2 ${KPI_ICON.blue.ring} bg-background`}
            >
              <ShoppingCart
                className={`h-4 w-4 ${KPI_ICON.blue.icon}`}
                aria-hidden
              />
            </div>
          </CardHeader>
          <CardContent>
            {kpiLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {ordersCount ?? '—'}
                </p>
                {dash ? (
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {(ordersDeltaPct ?? 0) >= 0 ? (
                      <ArrowUpRight
                        className="h-3.5 w-3.5 text-green-600"
                        aria-hidden
                      />
                    ) : (
                      <ArrowDownRight
                        className="h-3.5 w-3.5 text-red-600"
                        aria-hidden
                      />
                    )}
                    <span
                      className={
                        (ordersDeltaPct ?? 0) >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {(ordersDeltaPct ?? 0) >= 0 ? '+' : ''}
                      {String(ordersDeltaPct ?? 0)}%
                    </span>
                    <span>{ordersDeltaCaption}</span>
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          className="cursor-pointer transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            navigate('/orders?statuses=NEW,PICKING,INVOICED');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/orders?statuses=NEW,PICKING,INVOICED');
            }
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Bekleyen siparişler
            </CardTitle>
            <div
              className={`rounded-full p-2 ring-2 ${KPI_ICON.orange.ring} bg-background`}
            >
              <Clock className={`h-4 w-4 ${KPI_ICON.orange.icon}`} aria-hidden />
            </div>
          </CardHeader>
          <CardContent>
            {kpiLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <>
                <p
                  className={`text-2xl font-bold tabular-nums ${pendingOrdersTone(dash?.pendingOrders ?? 0)}`}
                >
                  {dash?.pendingOrders ?? '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Siparişlere gitmek için tıklayın
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam ürün</CardTitle>
            <div
              className={`rounded-full p-2 ring-2 ${KPI_ICON.green.ring} bg-background`}
            >
              <Package className={`h-4 w-4 ${KPI_ICON.green.icon}`} aria-hidden />
            </div>
          </CardHeader>
          <CardContent>
            {kpiLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">
                {dash?.totalProducts?.toLocaleString('tr-TR') ?? '—'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Aktif bağlantılar
            </CardTitle>
            <div
              className={`rounded-full p-2 ring-2 ${KPI_ICON.purple.ring} bg-background`}
            >
              <Plug className={`h-4 w-4 ${KPI_ICON.purple.icon}`} aria-hidden />
            </div>
          </CardHeader>
          <CardContent>
            {kpiLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">
                {dash
                  ? `${String(dash.activeConnections)}/${String(dash.totalConnections)}`
                  : '—'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          className="cursor-pointer transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            navigate('/listings?stockTier=LOW');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/listings?stockTier=LOW');
            }
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Düşük stok</CardTitle>
            <div
              className={`rounded-full p-2 ring-2 ${KPI_ICON.sky.ring} bg-background`}
            >
              <AlertTriangle
                className={`h-4 w-4 ${KPI_ICON.sky.icon}`}
                aria-hidden
              />
            </div>
          </CardHeader>
          <CardContent>
            {kpiLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">
                {dash?.lowStockCount ?? '—'}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Stok 1–5 arası listeleme · listeye gitmek için tıklayın
            </p>
          </CardContent>
        </Card>
      </div>

      {dashboardSummaryQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(dashboardSummaryQuery.error)}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              void dashboardSummaryQuery.refetch();
            }}
          >
            Tekrar dene
          </Button>
        </div>
      ) : null}

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
              <TableSkeleton rows={5} cols={5} />
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
                      key={row.connectionId}
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
                        disabled={triggerSyncMutation.isPending}
                        onClick={() => {
                          triggerSyncMutation.mutate(row.connectionId, {
                            onSuccess: () => {
                              toast.success('Senkron kuyruğa alındı.');
                            },
                            onError: (err) => {
                              toast.error(getApiErrorMessage(err));
                            },
                          });
                        }}
                      >
                        {triggerSyncMutation.isPending
                          ? 'Kuyruk…'
                          : 'Şimdi Sync Et'}
                      </Button>
                    </div>
                  );
                })
              : null}
          </CardContent>
        </Card>
      </div>

      <ActivityFeed />
    </div>
  );
}
