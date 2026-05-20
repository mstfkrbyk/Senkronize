import type { Marketplace } from '@prisma/client';

export interface SyncResult {
  platform: Marketplace;
  success: boolean;
  jobId?: string;
  itemsProcessed?: number;
  errorMessage?: string;
}

export interface DeltaSyncResult {
  platform: Marketplace;
  productsSynced: number;
  jobIds: string[];
}

export interface QueueDepthStatus {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}
