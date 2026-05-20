import type { ReactElement, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  useMarketplaceConnections,
  useTriggerManualSync,
} from '@/hooks/useConnections';
import { api } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { PlatformSyncStat, SyncLogEntry, SyncLogStatus } from '@/types/sync-log';

type PlatformFilter = 'all' | string;
type StatusFilter = 'all' | SyncLogStatus;

const JOB_TYPE_LABELS: Record<string, string> = {
  orders: 'Siparişler',
  stock: 'Stok',
  price: 'Fiyat',
  listings: 'İlanlar',
  returns: 'İadeler',
};

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

function platformCell(platform: string): ReactNode {
  const branding = getMarketplaceBranding(platform);
  return (
    <span className="flex items-center gap-2">
      {branding.logo}
      {branding.label}
    </span>
  );
}

export function SyncHistoryPage(): ReactElement {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [syncConnectionId, setSyncConnectionId] = useState<string>('');

  const { data: connections = [] } = useMarketplaceConnections();
  const triggerSync = useTriggerManualSync();

  const activeConnections = useMemo(
    () => connections.filter((c) => c.isActive),
    [connections],
  );

  const logsQuery = useQuery({
    queryKey: ['sync-logs', platformFilter, statusFilter],
    queryFn: async (): Promise<SyncLogEntry[]> => {
      const params = new URLSearchParams();
      if (platformFilter !== 'all') {
        params.set('platform', platformFilter);
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      params.set('limit', '50');
      const { data } = await api.get<{ data: SyncLogEntry[] }>(
        `/sync/logs?${params.toString()}`,
      );
      return data.data;
    },
  });

  const statsQuery = useQuery({
    queryKey: ['sync-stats'],
    queryFn: async (): Promise<PlatformSyncStat[]> => {
      const { data } = await api.get<{ data: PlatformSyncStat[] }>('/sync/stats');
      return data.data;
    },
  });

  const handleTriggerSync = (): void => {
    if (!syncConnectionId) {
      toast.error('Lütfen bir bağlantı seçin');
      return;
    }
    triggerSync.mutate(syncConnectionId, {
      onSuccess: () => {
        toast.success('Senkronizasyon kuyruğa alındı');
        void logsQuery.refetch();
        void statsQuery.refetch();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sync Geçmişi</h1>
          <p className="text-sm text-muted-foreground">
            Pazaryeri senkronizasyon kayıtları ve platform başarı oranları
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sync-connection">Bağlantı</Label>
            <Select
              value={syncConnectionId}
              onValueChange={setSyncConnectionId}
            >
              <SelectTrigger id="sync-connection" className="w-[220px]">
                <SelectValue placeholder="Bağlantı seçin" />
              </SelectTrigger>
              <SelectContent>
                {activeConnections.map((c) => {
                  const b = getMarketplaceBranding(c.platform);
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {b.logo}
                        {b.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={handleTriggerSync}
            disabled={!syncConnectionId || triggerSync.isPending}
          >
            {triggerSync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Şimdi Sync Et
          </Button>
        </div>
      </div>

      {statsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (statsQuery.data?.length ?? 0) > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsQuery.data?.map((stat) => {
            const b = getMarketplaceBranding(stat.platform);
            return (
              <Card key={stat.platform}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {b.logo}
                    {b.label}
                  </CardTitle>
                  <CardDescription>
                    Başarı oranı: %{stat.successRate.toFixed(1)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>
                    {stat.totalRuns} çalışma · {stat.successRuns} başarılı ·{' '}
                    {stat.failedRuns} hatalı
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Kayıtlar</CardTitle>
          <CardDescription>Son 50 senkronizasyon işlemi</CardDescription>
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label>Platform</Label>
              <Select
                value={platformFilter}
                onValueChange={(v) => setPlatformFilter(v as PlatformFilter)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {activeConnections.map((c) => {
                    const b = getMarketplaceBranding(c.platform);
                    return (
                      <SelectItem key={c.platform} value={c.platform}>
                        {b.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Durum</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="RUNNING">Çalışıyor</SelectItem>
                  <SelectItem value="SUCCESS">Başarılı</SelectItem>
                  <SelectItem value="PARTIAL">Kısmi</SelectItem>
                  <SelectItem value="FAILED">Başarısız</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logsQuery.isError ? (
            <p className="text-sm text-destructive">
              Kayıtlar yüklenemedi. Lütfen sayfayı yenileyin.
            </p>
          ) : (logsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz senkronizasyon kaydı yok.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>İş türü</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlenen</TableHead>
                  <TableHead className="text-right">Başarısız</TableHead>
                  <TableHead className="text-right">Süre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsQuery.data?.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(row.startedAt), 'dd MMM yyyy HH:mm', {
                        locale: tr,
                      })}
                    </TableCell>
                    <TableCell>{platformCell(row.platform)}</TableCell>
                    <TableCell>
                      {JOB_TYPE_LABELS[row.jobType] ?? row.jobType}
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.itemsProcessed}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.itemsFailed}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDuration(row.durationMs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
