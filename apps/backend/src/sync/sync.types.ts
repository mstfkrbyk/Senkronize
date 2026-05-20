import type {
  ConflictResolution,
  ConflictType,
  Marketplace,
  SyncConflict,
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
