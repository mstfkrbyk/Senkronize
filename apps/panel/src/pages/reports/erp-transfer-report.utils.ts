import type { ErpConnectionDto } from '@/hooks/useErpConnections';
import type { SyncLogEntry } from '@/types/sync-log';

export interface ErpTransferReportSummary {
  totalConnections: number;
  activeConnections: number;
  lastSyncAt: string | null;
  totalSyncErrors: number;
  recentLogCount: number;
  failedLogCount: number;
}

export function buildErpTransferReportSummary(
  connections: ErpConnectionDto[],
  logs: SyncLogEntry[],
): ErpTransferReportSummary {
  const activeConnections = connections.filter((c) => c.isActive).length;
  const totalSyncErrors = connections.reduce((sum, c) => sum + c.syncErrorCount, 0);

  const connectionLastSync = connections
    .map((c) => c.lastSyncAt)
    .filter((value): value is string => value != null)
    .map((value) => new Date(value).getTime());

  const logLastSync = logs
    .map((log) => log.completedAt ?? log.startedAt)
    .map((value) => new Date(value).getTime());

  const latestMs = Math.max(0, ...connectionLastSync, ...logLastSync);
  const lastSyncAt =
    latestMs > 0 ? new Date(latestMs).toISOString() : null;

  const failedLogCount = logs.filter((log) => log.status === 'FAILED').length;

  return {
    totalConnections: connections.length,
    activeConnections,
    lastSyncAt,
    totalSyncErrors,
    recentLogCount: logs.length,
    failedLogCount,
  };
}
