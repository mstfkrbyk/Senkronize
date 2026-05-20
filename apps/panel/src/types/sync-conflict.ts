export type ConflictType =
  | 'STOCK_MISMATCH'
  | 'PRICE_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'PRODUCT_NOT_FOUND'
  | 'DUPLICATE_ORDER';

export type ConflictResolution =
  | 'USE_LOCAL'
  | 'USE_REMOTE'
  | 'MANUAL'
  | 'IGNORED';

export interface SyncConflictDto {
  id: string;
  organizationId: string;
  platform: string;
  entityType: string;
  entityId: string;
  conflictType: ConflictType;
  localValue: unknown;
  remoteValue: unknown;
  resolution: ConflictResolution | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ConflictStatsDto {
  pending: number;
  resolved: number;
  ignored: number;
  byType: Record<ConflictType, number>;
}

export interface AutoResolveResultDto {
  resolved: number;
  ignored: number;
  failed: number;
}

export type StockDistributionStrategy = 'EQUAL' | 'PROPORTIONAL' | 'PRIORITY';

export interface DistributionPreviewDto {
  barcode: string;
  totalStock: number;
  byPlatform: Record<string, number>;
}

export interface DistributionResultDto {
  distribution: Record<string, number>;
  pushedAt: string;
  jobIds: string[];
}
