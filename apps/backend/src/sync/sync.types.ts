import type {
  ConflictResolution,
  ConflictType,
  Marketplace,
  SyncConflict,
  SyncLog,
  SyncLogStatus,
} from '@prisma/client';

export interface AutoResolveResult {
  resolved: number;
  ignored: number;
  failed: number;
  details: { conflictId: string; resolution: ConflictResolution }[];
}

export interface ConflictStats {
  pending: number;
  resolved: number;
  ignored: number;
  byType: Record<ConflictType, number>;
}

export interface SerializedSyncConflict {
  id: string;
  organizationId: string;
  platform: Marketplace;
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

export interface SerializedSyncLog {
  id: string;
  organizationId: string;
  platform: Marketplace;
  jobType: string;
  status: SyncLogStatus;
  itemsProcessed: number;
  itemsFailed: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export function serializeSyncLog(row: SyncLog): SerializedSyncLog {
  const completedAt = row.completedAt?.toISOString() ?? null;
  const durationMs =
    row.completedAt !== null
      ? row.completedAt.getTime() - row.startedAt.getTime()
      : null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    platform: row.platform,
    jobType: row.jobType,
    status: row.status,
    itemsProcessed: row.itemsProcessed,
    itemsFailed: row.itemsFailed,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt.toISOString(),
    completedAt,
    durationMs,
  };
}

export function serializeConflict(row: SyncConflict): SerializedSyncConflict {
  return {
    id: row.id,
    organizationId: row.organizationId,
    platform: row.platform,
    entityType: row.entityType,
    entityId: row.entityId,
    conflictType: row.conflictType,
    localValue: row.localValue,
    remoteValue: row.remoteValue,
    resolution: row.resolution,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}
