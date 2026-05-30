import type { ErpType } from '@prisma/client';

/** SyncLog.platform yalnızca Marketplace enum kabul ettiği için ERP işleri bu sabitle işaretlenir. */
export const ERP_SYNC_LOG_PLATFORM_MARKER = 'IDEASOFT' as const;

export interface ParsedErpSyncJobType {
  erpType: string;
  erpConnectionId: string;
  syncType: string;
}

export function buildErpSyncJobType(
  erpType: string,
  erpConnectionId: string,
  syncType: string,
): string {
  return `erp:${erpType}:${erpConnectionId}:${syncType}`;
}

/** `erp:BIZIMHESAP:connId:stock` veya eski `erp:connId:stock` formatını çözümler. */
export function parseErpSyncJobType(jobType: string): ParsedErpSyncJobType | null {
  if (!jobType.startsWith('erp:')) {
    return null;
  }
  const parts = jobType.split(':');
  if (parts.length === 4 && parts[1] && parts[2] && parts[3]) {
    return {
      erpType: parts[1],
      erpConnectionId: parts[2],
      syncType: parts[3],
    };
  }
  if (parts.length === 3 && parts[1] && parts[2]) {
    return {
      erpType: '',
      erpConnectionId: parts[1],
      syncType: parts[2],
    };
  }
  return null;
}

export function isErpSyncJobType(jobType: string): boolean {
  return jobType.startsWith('erp:');
}

export function erpSyncLogPlatform(): typeof ERP_SYNC_LOG_PLATFORM_MARKER {
  return ERP_SYNC_LOG_PLATFORM_MARKER;
}

export function resolveErpSyncLogErpType(
  jobType: string,
  connectionTypeById: ReadonlyMap<string, ErpType>,
): string | null {
  const parsed = parseErpSyncJobType(jobType);
  if (!parsed) {
    return null;
  }
  if (parsed.erpType) {
    return parsed.erpType;
  }
  return connectionTypeById.get(parsed.erpConnectionId) ?? null;
}
