import { buildHourlyStatsFromLogs } from '@/pages/connections/connection-utils';
import type {
  CircuitBreakerState,
  ConnectionHealthDto,
  ConnectionHealthStatus,
} from '@/types/connection-health';
import type { SyncLogEntry } from '@/types/sync-log';

/** Backend `/connections/:id/health` yanıtı */
export interface ConnectionHealthApiResponse {
  status: string;
  lastSuccessAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
  circuitBreaker: CircuitBreakerState;
  rateLimit: {
    remaining?: number;
    used?: number;
    limit: number;
    resetAt: string | null;
  };
  consecutiveErrors?: number;
  syncErrorCount?: number;
  hourlyStats?: ConnectionHealthDto['hourlyStats'];
}

function mapHealthStatus(status: string): ConnectionHealthStatus {
  switch (status) {
    case 'healthy':
    case 'active':
      return 'active';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'inactive';
  }
}

export function normalizeConnectionHealthApiResponse(
  raw: ConnectionHealthApiResponse,
  logs: SyncLogEntry[] = [],
): ConnectionHealthDto {
  const limit = raw.rateLimit.limit;
  const used =
    typeof raw.rateLimit.used === 'number'
      ? raw.rateLimit.used
      : Math.max(0, limit - (raw.rateLimit.remaining ?? 0));

  return {
    status: mapHealthStatus(raw.status),
    lastSuccessfulSyncAt:
      raw.lastSuccessAt ?? raw.lastSuccessfulSyncAt ?? null,
    lastErrorMessage: raw.lastErrorMessage ?? null,
    lastErrorAt: raw.lastErrorAt ?? null,
    syncErrorCount: raw.consecutiveErrors ?? raw.syncErrorCount ?? 0,
    rateLimit: {
      used,
      limit,
      resetAt: raw.rateLimit.resetAt,
    },
    circuitBreaker: raw.circuitBreaker,
    hourlyStats: raw.hourlyStats ?? buildHourlyStatsFromLogs(logs),
  };
}
