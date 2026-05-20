import { Loader2, RefreshCw } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTriggerManualSync } from '@/hooks/useConnections';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { SyncStatusItem } from '@/types/sync';

function statusDotClass(status: SyncStatusItem['status']): string {
  const map: Record<SyncStatusItem['status'], string> = {
    healthy: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };
  return map[status];
}

function statusLabel(status: SyncStatusItem['status']): string {
  const map: Record<SyncStatusItem['status'], string> = {
    healthy: 'Sağlıklı',
    warning: 'Yavaş',
    error: 'Hata',
  };
  return map[status];
}

export function SyncStatusWidget(): ReactElement {
  const triggerSync = useTriggerManualSync();
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ['sync-status'],
    queryFn: async (): Promise<SyncStatusItem[]> => {
      const { data } = await api.get<SyncStatusItem[]>('/sync/status');
      return data;
    },
  });

  const handleSync = (connectionId: string): void => {
    setSyncingIds((prev) => new Set(prev).add(connectionId));
    triggerSync.mutate(connectionId, {
      onSuccess: () => {
        toast.success('Senkronizasyon kuyruğa alındı.');
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
      },
      onSettled: () => {
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(connectionId);
          return next;
        });
      },
    });
  };

  return (
    <Card className="h-full" data-tour="dashboard-sync">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle>Senkronizasyon</CardTitle>
          <CardDescription>Aktif bağlantılar ve son sync</CardDescription>
        </div>
        {query.isFetching && !query.isLoading ? (
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 max-h-80 overflow-y-auto">
        {query.isLoading ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : null}
        {!query.isLoading && (query.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Bağlantı yok"
            description="Pazaryeri bağlantısı ekleyerek senkronizasyonu başlatın."
          />
        ) : null}
        {query.data?.map((row) => {
          const branding = getMarketplaceBranding(row.platform);
          const isSyncing = syncingIds.has(row.connectionId);
          const last = row.lastSuccessAt
            ? formatDistanceToNow(new Date(row.lastSuccessAt), {
                addSuffix: true,
                locale: tr,
              })
            : 'Henüz yok';

          return (
            <div
              key={row.connectionId}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
            >
              <span className="text-xl shrink-0" aria-hidden>
                {branding.logo}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn('h-2 w-2 shrink-0 rounded-full', statusDotClass(row.status))}
                    title={statusLabel(row.status)}
                    aria-label={statusLabel(row.status)}
                  />
                  <p className="truncate text-sm font-medium">{branding.label}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Son sync: {last}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0"
                disabled={isSyncing || triggerSync.isPending}
                onClick={() => {
                  handleSync(row.connectionId);
                }}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  'Şimdi Sync Et'
                )}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
