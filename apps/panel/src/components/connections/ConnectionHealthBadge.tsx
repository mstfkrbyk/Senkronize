import type { ReactElement } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import {
  statusBadgeClass,
  statusLabel,
} from '@/pages/connections/connection-utils';
import type { MarketplaceConnectionDto } from '@/types/connection';
import type { ConnectionHealthStatus } from '@/types/connection-health';

interface Props {
  connectionId: string;
  fallbackConnection?: MarketplaceConnectionDto | null;
  showLabel?: boolean;
}

function dotClass(status: ConnectionHealthStatus): string {
  const map: Record<ConnectionHealthStatus, string> = {
    active: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    inactive: 'bg-slate-400',
  };
  return map[status];
}

export function ConnectionHealthBadge({
  connectionId,
  fallbackConnection,
  showLabel = true,
}: Props): ReactElement {
  const healthQuery = useConnectionHealth(connectionId, fallbackConnection);
  const health = healthQuery.data;
  const status = health?.status ?? 'inactive';

  if (healthQuery.isLoading) {
    return <Skeleton className="h-5 w-16 rounded-full" />;
  }

  const lastSyncLabel = health?.lastSuccessfulSyncAt
    ? formatDistanceToNow(new Date(health.lastSuccessfulSyncAt), {
        addSuffix: true,
        locale: tr,
      })
    : 'Henüz yok';

  const tooltipLines = [
    health?.lastErrorMessage ? `Son hata: ${health.lastErrorMessage}` : null,
    `Son başarılı sync: ${lastSyncLabel}`,
    health?.circuitBreaker ? `Circuit breaker: ${health.circuitBreaker}` : null,
  ].filter((line): line is string => line !== null);

  const badge = showLabel ? (
    <Badge variant="outline" className={statusBadgeClass(status)}>
      {statusLabel(status)}
    </Badge>
  ) : (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass(status)}`}
      aria-label={statusLabel(status)}
    />
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs space-y-1">
          {tooltipLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
