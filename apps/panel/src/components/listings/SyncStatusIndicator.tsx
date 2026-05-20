import type { ReactElement } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useListingSyncProgressStore } from '@/store/listingSyncProgress.store';

interface Props {
  platform: string;
  lastSyncAt: string | null;
  className?: string;
}

function formatLastSync(iso: string | null): string {
  if (!iso) {
    return 'Henüz senkronize edilmedi';
  }
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: tr });
  } catch {
    return iso;
  }
}

export function SyncStatusIndicator({
  platform,
  lastSyncAt,
  className,
}: Props): ReactElement {
  const progress = useListingSyncProgressStore(
    (s) => s.byPlatform[platform] ?? null,
  );
  const isSyncing = progress != null && progress.current < progress.total;

  if (isSyncing) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ''}`}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" aria-hidden />
              <span className="tabular-nums">
                {Math.min(
                  100,
                  Math.round((progress.current / progress.total) * 100),
                )}
                %
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{platform} senkronizasyonu devam ediyor</p>
            <p className="text-xs text-muted-foreground">
              {progress.current} / {progress.total}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`text-xs text-muted-foreground tabular-nums ${className ?? ''}`}
          >
            {lastSyncAt
              ? formatDistanceToNow(new Date(lastSyncAt), {
                  addSuffix: true,
                  locale: tr,
                })
              : '—'}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Son senkron: {formatLastSync(lastSyncAt)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
