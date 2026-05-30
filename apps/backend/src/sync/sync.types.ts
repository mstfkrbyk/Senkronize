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
  /** ERP senkron işi ise gerçek ERP türü (ör. BIZIMHESAP) */
  erpType?: string | null;
  isErpJob?: boolean;
  /** UI'da gösterilecek platform/ERP etiketi */
  displayPlatform?: string;
}

export function serializeSyncLog(
  row: SyncLog,
  erpConnectionTypes?: ReadonlyMap<string, string>,
): SerializedSyncLog {
  const completedAt = row.completedAt?.toISOString() ?? null;
  const durationMs =
    row.completedAt !== null
      ? row.completedAt.getTime() - row.startedAt.getTime()
      : null;

  let erpType: string | null = null;
  let isErpJob = false;
  if (row.jobType.startsWith('erp:')) {
    isErpJob = true;
    const parts = row.jobType.split(':');
    if (parts.length === 4 && parts[1]) {
      erpType = parts[1];
    } else if (parts.length === 3 && parts[1] && erpConnectionTypes) {
      erpType = erpConnectionTypes.get(parts[1]) ?? null;
    }
  }

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
    erpType,
    isErpJob,
    displayPlatform: erpType ?? row.platform,
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
