import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSyncMonitorCleanup, useSyncMonitorListener } from '@/hooks/useSyncMonitorListener';
import { useTriggerManualSync } from '@/hooks/useConnections';
import { getApiErrorMessage } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import { useSyncMonitorStore } from '@/store/syncMonitor.store';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  compact?: boolean;
}

function SyncMonitorContent({ className }: { className?: string }): ReactElement | null {
  const entries = useSyncMonitorStore((s) => s.entries);
  const retryEntry = useSyncMonitorStore((s) => s.retryEntry);
  const triggerSync = useTriggerManualSync();

  const visibleEntries = useMemo(
    () => Object.values(entries).sort((a, b) => b.updatedAt - a.updatedAt),
    [entries],
  );

  if (visibleEntries.length === 0) {
    return null;
  }

  const handleRetry = (connectionId: string, key: string): void => {
    retryEntry(key);
    triggerSync.mutate(connectionId, {
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      {visibleEntries.map((entry) => {
        const branding = getMarketplaceBranding(entry.platform);
        const pct =
          entry.total > 0 ? Math.min(100, Math.round((entry.current / entry.total) * 100)) : 0;

        return (
          <div
            key={entry.key}
            className={cn(
              'rounded-lg border p-3',
              entry.status === 'error' && 'border-red-200 bg-red-50/60',
              entry.status === 'completed' && 'border-green-200 bg-green-50/40',
              entry.status === 'running' && 'border-border bg-muted/30',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden>{branding.logo}</span>
                  <span className="truncate">{branding.label}</span>
                  {entry.status === 'running' ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                  ) : null}
                  {entry.status === 'completed' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                  ) : null}
                  {entry.status === 'error' ? (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                  {entry.phase} · {entry.current}/{entry.total}
                </p>
                {entry.status !== 'error' ? (
                  <Progress value={pct} className="mt-2 h-1.5" />
                ) : null}
                {entry.status === 'error' && entry.errorMessage ? (
                  <p className="mt-2 text-xs text-red-800">{entry.errorMessage}</p>
                ) : null}
              </div>
              {entry.status === 'error' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-red-200"
                  disabled={triggerSync.isPending}
                  onClick={() => {
                    handleRetry(entry.connectionId, entry.key);
                  }}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  Tekrar Dene
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** WebSocket dinleyicisini layout'ta bir kez çalıştırın. */
export function useSyncMonitorEffects(): void {
  useSyncMonitorListener();
  useSyncMonitorCleanup();
}

export function SyncMonitorPanel({ className, compact = false }: Props): ReactElement | null {
  const entries = useSyncMonitorStore((s) => s.entries);
  const hasEntries = Object.keys(entries).length > 0;

  if (!hasEntries) {
    return null;
  }

  const content = <SyncMonitorContent className={className} />;

  if (compact) {
    return content;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aktif Senkronizasyonlar</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
