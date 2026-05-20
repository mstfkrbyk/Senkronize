import type { ReactElement } from 'react';
import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  TestTube2,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { ConnectionHealthBadge } from '@/components/connections/ConnectionHealthBadge';
import { SyncMonitorPanel } from '@/components/connections/SyncMonitorPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useDeleteConnection,
  useMarketplaceConnections,
  useTestConnection,
  useTriggerManualSync,
} from '@/hooks/useConnections';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useBreadcrumbTail } from '@/hooks/useBreadcrumbTail';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  circuitBreakerBadgeClass,
  kindLabel,
  marketplaceKind,
} from '@/pages/connections/connection-utils';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { SyncLogEntry, SyncLogStatus } from '@/types/sync-log';

function statusBadge(status: SyncLogStatus): ReactElement {
  const map: Record<
    SyncLogStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    RUNNING: { label: 'Çalışıyor', variant: 'secondary' },
    SUCCESS: { label: 'Başarılı', variant: 'default' },
    PARTIAL: { label: 'Kısmi', variant: 'outline' },
    FAILED: { label: 'Başarısız', variant: 'destructive' },
  };
  const c = map[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function formatDuration(ms: number | null): string {
  if (ms === null) {
    return '—';
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const sec = Math.round(ms / 1000);
  if (sec < 60) {
    return `${sec} sn`;
  }
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min} dk ${rem} sn` : `${min} dk`;
}

function jobTypeLabel(jobType: string): string {
  const parts = jobType.split(':');
  const type = parts[parts.length - 1] ?? jobType;
  const labels: Record<string, string> = {
    orders: 'Siparişler',
    stock: 'Stok',
    price: 'Fiyat',
    listings: 'İlanlar',
    returns: 'İadeler',
  };
  return labels[type] ?? type;
}

export function ConnectionDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const connectionId = id ?? null;
  const navigate = useNavigate();

  const connectionsQuery = useMarketplaceConnections();
  const connection = connectionsQuery.data?.find((c) => c.id === connectionId) ?? null;
  const branding = connection ? getMarketplaceBranding(connection.platform) : null;
  const pageTitle = branding ? `${branding.label} bağlantısı` : 'Bağlantı detayı';

  usePageTitle(pageTitle);
  useBreadcrumbTail(pageTitle);

  const healthQuery = useConnectionHealth(connectionId, connection);
  const testMutation = useTestConnection();
  const triggerSync = useTriggerManualSync();
  const deleteMutation = useDeleteConnection();

  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const logsQuery = useQuery({
    queryKey: ['connection-sync-logs', connectionId, connection?.platform],
    enabled: connectionId !== null && connection !== null,
    queryFn: async (): Promise<SyncLogEntry[]> => {
      const params = new URLSearchParams({
        platform: connection!.platform,
        limit: '20',
      });
      const { data } = await api.get<{ data: SyncLogEntry[] }>(
        `/sync/logs?${params.toString()}`,
      );
      return data.data;
    },
  });

  const handleTest = (): void => {
    if (!connectionId) {
      return;
    }
    setTestResult(null);
    testMutation.mutate(
      { connectionId },
      {
        onSuccess: (res) => {
          if (res.connected) {
            setTestResult({ ok: true, message: 'Bağlantı testi başarılı.' });
          } else {
            setTestResult({
              ok: false,
              message: 'Bağlantı testi başarısız oldu.',
            });
          }
        },
        onError: (error) => {
          setTestResult({
            ok: false,
            message: getApiErrorMessage(error),
          });
        },
      },
    );
  };

  const handleSyncNow = (): void => {
    if (!connectionId) {
      return;
    }
    triggerSync.mutate(connectionId, {
      onSuccess: () => {
        toast.success('Senkron kuyruğa alındı.');
        void logsQuery.refetch();
        void healthQuery.refetch();
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  const handleDelete = (): void => {
    if (!connectionId) {
      return;
    }
    deleteMutation.mutate(connectionId, {
      onSuccess: () => {
        toast.success('Bağlantı silindi.');
        navigate('/connections');
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  if (connectionsQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (connectionsQuery.isError) {
    return (
      <div className="p-6 text-sm text-destructive">
        {getApiErrorMessage(connectionsQuery.error)}
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">Bağlantı bulunamadı.</p>
        <Button variant="outline" asChild>
          <Link to="/connections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Bağlantılara dön
          </Link>
        </Button>
      </div>
    );
  }

  const health = healthQuery.data;
  const chartData =
    health?.hourlyStats.map((row) => ({
      label: row.hour.slice(-5),
      başarı: row.success,
      hata: row.error,
    })) ?? [];

  const ratePct =
    health && health.rateLimit.limit > 0
      ? Math.round((health.rateLimit.used / health.rateLimit.limit) * 100)
      : 0;

  const lastSyncLabel = connection.lastSyncAt
    ? formatDistanceToNow(new Date(connection.lastSyncAt), {
        addSuffix: true,
        locale: tr,
      })
    : 'Henüz senkron yok';

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/connections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Bağlantılar
          </Link>
        </Button>
      </div>

      <SyncMonitorPanel />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span aria-hidden>{branding?.logo}</span>
                {branding?.label}
              </CardTitle>
              <CardDescription className="mt-1">
                {branding?.accountFieldLabel}: {connection.accountLabel ?? '—'}
              </CardDescription>
            </div>
            <ConnectionHealthBadge connectionId={connection.id} fallbackConnection={connection} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Tip</p>
            <p className="font-medium">{kindLabel(marketplaceKind(connection.platform))}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Oluşturulma</p>
            <p className="font-medium">
              {format(new Date(connection.createdAt), 'd MMM yyyy', { locale: tr })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Son sync</p>
            <p className="font-medium">{lastSyncLabel}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Durum</p>
            <p className="font-medium">{connection.isActive ? 'Etkin' : 'Pasif'}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sağlık göstergesi</CardTitle>
            <CardDescription>Son 24 saat başarı / hata dağılımı</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {healthQuery.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="başarı" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="hata" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate limit & circuit breaker</CardTitle>
            <CardDescription>Platform API kullanım durumu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rate limit</span>
                <span className="font-medium tabular-nums">
                  {health?.rateLimit.used ?? 0} / {health?.rateLimit.limit ?? 100}
                </span>
              </div>
              <Progress value={ratePct} className="h-2" />
              {health?.rateLimit.resetAt ? (
                <p className="text-xs text-muted-foreground">
                  Sıfırlanma:{' '}
                  {format(new Date(health.rateLimit.resetAt), 'HH:mm', { locale: tr })}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Circuit breaker</span>
              {health ? (
                <Badge
                  variant="outline"
                  className={circuitBreakerBadgeClass(health.circuitBreaker)}
                >
                  {health.circuitBreaker}
                </Badge>
              ) : (
                <Skeleton className="h-6 w-24" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={testMutation.isPending}
                onClick={() => {
                  handleTest();
                }}
              >
                {testMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TestTube2 className="mr-2 h-4 w-4" />
                )}
                Test Bağlantısı
              </Button>
              <Button
                type="button"
                disabled={triggerSync.isPending || !connection.isActive}
                onClick={() => {
                  handleSyncNow();
                }}
              >
                {triggerSync.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Şimdi Sync Et
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label="Diğer işlemler">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      handleDelete();
                    }}
                  >
                    Sil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/sync/history?platform=${encodeURIComponent(connection.platform)}`}>
                      Sync geçmişi
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {testResult ? (
              <p
                className={`rounded-md border px-3 py-2 text-sm ${
                  testResult.ok
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {testResult.message}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync geçmişi</CardTitle>
          <CardDescription>Son 20 senkron işlemi</CardDescription>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kayıtlar yükleniyor…
            </div>
          ) : null}
          {logsQuery.isError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(logsQuery.error)}</p>
          ) : null}
          {!logsQuery.isLoading && !logsQuery.isError && (logsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz senkron kaydı yok.</p>
          ) : null}
          {(logsQuery.data?.length ?? 0) > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>İşlenen</TableHead>
                  <TableHead>Süre</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Detay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsQuery.data?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.startedAt), 'd MMM HH:mm', { locale: tr })}
                    </TableCell>
                    <TableCell>{jobTypeLabel(log.jobType)}</TableCell>
                    <TableCell>
                      {log.itemsProcessed}
                      {log.itemsFailed > 0 ? ` (${log.itemsFailed} hata)` : ''}
                    </TableCell>
                    <TableCell>{formatDuration(log.durationMs)}</TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {log.errorMessage ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
