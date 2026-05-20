export type SyncLogStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';

export type SyncJobType = 'orders' | 'stock' | 'price' | 'listings' | 'returns';

export interface SyncLogEntry {
  id: string;
  organizationId: string;
  platform: string;
  jobType: string;
  status: SyncLogStatus;
  itemsProcessed: number;
  itemsFailed: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export interface PlatformSyncStat {
  platform: string;
  totalRuns: number;
  successRuns: number;
  partialRuns: number;
  failedRuns: number;
  successRate: number;
  lastRunAt: string | null;
  lastStatus: SyncLogStatus | null;
}
