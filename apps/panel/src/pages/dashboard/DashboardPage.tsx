import type { LucideIcon } from 'lucide-react';
import {
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
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { SyncStatusItem } from '@/types/sync';

const KPI_CARDS: {
  title: string;
  key: keyof DashboardSummary;
  icon: LucideIcon;
  color: 'blue' | 'orange' | 'green' | 'purple';
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
    title: 'Aktif Listeler',
    key: 'activeListings',
    icon: Package,
    color: 'green',
  },
  {
    title: 'Entegrasyonlar',
    key: 'connections',
    icon: Plug,
    color: 'purple',
  },
];

interface DashboardSummary {
  todayOrders: number;
  pendingOrders: number;
  activeListings: number;
  connections: number;
}

const MOCK_SUMMARY: DashboardSummary = {
  todayOrders: 24,
  pendingOrders: 7,
  activeListings: 342,
  connections: 2,
};

const MOCK_ORDERS = [
  {
    id: '1',
    platform: 'TRENDYOL',
    customer: 'Ahmet Y.',
    amount: 459.9,
    status: 'Yeni',
    date: '2026-05-16',
  },
  {
    id: '2',
    platform: 'TRENDYOL',
    customer: 'Fatma K.',
    amount: 189.5,
    status: 'Kargoda',
    date: '2026-05-16',
  },
  {
    id: '3',
    platform: 'HEPSIBURADA',
    customer: 'Mehmet A.',
    amount: 729.0,
    status: 'Teslim Edildi',
    date: '2026-05-15',
  },
  {
    id: '4',
    platform: 'TRENDYOL',
    customer: 'Zeynep S.',
    amount: 99.9,
    status: 'Yeni',
    date: '2026-05-15',
  },
  {
    id: '5',
    platform: 'HEPSIBURADA',
    customer: 'Ali R.',
    amount: 1240.0,
    status: 'İptal',
    date: '2026-05-14',
  },
] as const;

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
  purple: { ring: 'ring-purple-100', icon: 'text-purple-600' },
};

function OrderStatusBadge({ status }: { status: string }): ReactElement {
  const tone: Record<string, string> = {
    Yeni: 'border-blue-200 bg-blue-50 text-blue-800',
    Kargoda: 'border-orange-200 bg-orange-50 text-orange-800',
    'Teslim Edildi': 'border-green-200 bg-green-50 text-green-800',
    İptal: 'border-red-200 bg-red-50 text-red-800',
  };
  return (
    <Badge variant="outline" className={tone[status] ?? ''}>
      {status}
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

export function DashboardPage(): ReactElement {
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async (): Promise<DashboardSummary> => {
      const { data } = await api.get<DashboardSummary>('/dashboard/summary');
      return data;
    },
    enabled: false,
    initialData: MOCK_SUMMARY,
  });

  const syncQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: async (): Promise<SyncStatusItem[]> => {
      const { data } = await api.get<SyncStatusItem[]>('/sync/status');
      return data;
    },
  });

  const summary = summaryQuery.data ?? MOCK_SUMMARY;

  const handleMockSyncTrigger = (): void => {
    toast.info('Senkron kuyruğu tetikleme yakında aktif olacak.');
  };

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          const colors = KPI_COLOR[kpi.color];
          const value = summary[kpi.key];
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
                <p className="text-2xl font-bold tabular-nums">{value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Haftalık siparişler</CardTitle>
          <CardDescription>Son 7 gün (örnek veri)</CardDescription>
        </CardHeader>
        <CardContent className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...MOCK_WEEKLY]} margin={{ left: 0, right: 8 }}>
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
            <CardDescription>Örnek veri — API bağlantısı yakında</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
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
                {MOCK_ORDERS.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {getMarketplaceBranding(order.platform).label}
                    </TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTry(order.amount)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.date}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              <p className="text-sm text-muted-foreground">
                Henüz entegrasyon yok
              </p>
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
