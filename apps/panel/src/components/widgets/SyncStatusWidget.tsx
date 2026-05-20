import { RefreshCw } from 'lucide-react';
import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

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
import { useTriggerManualSync } from '@/hooks/useConnections';
import { api, getApiErrorMessage } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { SyncStatusItem } from '@/types/sync';

function syncTone(status: SyncStatusItem['status']): string {
  const map: Record<SyncStatusItem['status'], string> = {
    healthy:
      'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200',
    warning:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    error:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  };
  return map[status];
}

function syncLabel(status: SyncStatusItem['status']): string {
  const map: Record<SyncStatusItem['status'], string> = {
    healthy: 'Aktif',
    warning: 'Yavaş',
    error: 'Hata',
  };
  return map[status];
}

export function SyncStatusWidget(): ReactElement {
  const triggerSync = useTriggerManualSync();

  const query = useQuery({
    queryKey: ['sync-status'],
    queryFn: async (): Promise<SyncStatusItem[]> => {
      const { data } = await api.get<SyncStatusItem[]>('/sync/status');
      return data;
    },
  });

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Senkronizasyon</CardTitle>
          <CardDescription>Platform başına son sync</CardDescription>
        </div>
        {query.isFetching ? (
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 max-h-80 overflow-y-auto">
        {query.isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : null}
        {!query.isLoading && (query.data?.length ?? 0) === 0 ? (
          <EmptyState title="Bağlantı yok" description="Pazaryeri ekleyin." />
        ) : null}
        {query.data?.map((row) => {
          const branding = getMarketplaceBranding(row.platform);
          const last = row.lastSuccessAt
            ? formatDistanceToNow(new Date(row.lastSuccessAt), {
                addSuffix: true,
                locale: tr,
              })
            : 'Henüz yok';
          return (
            <div
              key={row.connectionId}
              className="rounded-lg border bg-muted/30 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    <span className="mr-1" aria-hidden>
                      {branding.logo}
                    </span>
                    {branding.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Son: {last}</p>
                </div>
                <Badge variant="outline" className={syncTone(row.status)}>
                  {syncLabel(row.status)}
                </Badge>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2 w-full"
                disabled={triggerSync.isPending}
                onClick={() => {
                  triggerSync.mutate(row.connectionId, {
                    onSuccess: () => {
                      toast.success('Senkron kuyruğa alındı.');
                    },
                    onError: (err) => {
                      toast.error(getApiErrorMessage(err));
                    },
                  });
                }}
              >
                Şimdi sync et
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
