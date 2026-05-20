import type { SyncFrequency } from '@prisma/client';

export type UnifiedConnectionType =
  | 'MARKETPLACE'
  | 'ERP'
  | 'CARGO'
  | 'ECOMMERCE';

export type UnifiedConnectionStatus =
  | 'healthy'
  | 'warning'
  | 'error'
  | 'unknown'
  | 'inactive';

export interface UnifiedConnectionItem {
  id: string;
  type: UnifiedConnectionType;
  platform: string;
  name: string;
  status: UnifiedConnectionStatus;
  lastSyncAt: string | null;
  syncFrequency: SyncFrequency | null;
}
