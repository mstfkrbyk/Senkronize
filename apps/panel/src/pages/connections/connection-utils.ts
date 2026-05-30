import { ECOMMERCE_MARKETPLACE_IDS } from '@/lib/connection-form-fields';
import type { ErpConnectionDto } from '@/hooks/useErpConnections';
import { erpConnectionDisplayName } from '@/lib/erp-connection-display';
import type { ConnectionHealthDto, ConnectionHealthStatus, CircuitBreakerState } from '@/types/connection-health';
import type { MarketplaceConnectionDto } from '@/types/connection';
import type { SyncLogEntry } from '@/types/sync-log';

export type ConnectionKind = 'marketplace' | 'ecommerce' | 'erp' | 'cargo';

export type ConnectionRowStatus = ConnectionHealthStatus;

export interface UnifiedConnectionRow {
  id: string;
  kind: ConnectionKind;
  platform: string;
  name: string;
  isActive: boolean;
  lastSyncAt: string | null;
  syncErrorCount: number;
  lastErrorMessage: string | null;
  syncFrequencyLabel: string;
  status: ConnectionRowStatus;
  serverDomain?: string | null;
  linkedDocumentsLabel?: string | null;
}

const ECOMMERCE_SET = new Set<string>(ECOMMERCE_MARKETPLACE_IDS);

export function marketplaceKind(platform: string): 'marketplace' | 'ecommerce' {
  return ECOMMERCE_SET.has(platform) ? 'ecommerce' : 'marketplace';
}

export function deriveConnectionStatus(
  isActive: boolean,
  syncErrorCount: number,
  lastErrorMessage: string | null,
  lastSyncAt: string | null,
): ConnectionRowStatus {
  if (!isActive) {
    return 'inactive';
  }
  if (syncErrorCount >= 3) {
    return 'error';
  }
  if (syncErrorCount > 0 || lastErrorMessage) {
    return 'warning';
  }
  if (lastSyncAt) {
    const staleMs = Date.now() - new Date(lastSyncAt).getTime();
    if (staleMs > 24 * 60 * 60 * 1000) {
      return 'warning';
    }
  }
  return 'active';
}

function deriveCircuitBreaker(syncErrorCount: number): CircuitBreakerState {
  if (syncErrorCount >= 5) {
    return 'OPEN';
  }
  if (syncErrorCount >= 3) {
    return 'HALF_OPEN';
  }
  return 'CLOSED';
}

export function buildHourlyStatsFromLogs(logs: SyncLogEntry[]): ConnectionHealthDto['hourlyStats'] {
  const now = Date.now();
  const buckets = new Map<string, { success: number; error: number }>();

  for (let i = 23; i >= 0; i -= 1) {
    const t = new Date(now - i * 60 * 60 * 1000);
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:00`;
    buckets.set(key, { success: 0, error: 0 });
  }

  for (const log of logs) {
    const started = new Date(log.startedAt).getTime();
    if (now - started > 24 * 60 * 60 * 1000) {
      continue;
    }
    const d = new Date(log.startedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
    const bucket = buckets.get(key);
    if (!bucket) {
      continue;
    }
    if (log.status === 'FAILED') {
      bucket.error += 1;
    } else if (log.status === 'SUCCESS' || log.status === 'PARTIAL') {
      bucket.success += 1;
    }
  }

  return [...buckets.entries()].map(([hour, stats]) => ({
    hour,
    success: stats.success,
    error: stats.error,
  }));
}

export function deriveHealthFromConnection(
  connection: Pick<
    MarketplaceConnectionDto,
    'isActive' | 'syncErrorCount' | 'lastErrorMessage' | 'lastSyncAt'
  >,
  logs: SyncLogEntry[] = [],
): ConnectionHealthDto {
  const status = deriveConnectionStatus(
    connection.isActive,
    connection.syncErrorCount,
    connection.lastErrorMessage,
    connection.lastSyncAt,
  );
  const used = Math.min(connection.syncErrorCount * 12 + 8, 95);
  return {
    status,
    lastSuccessfulSyncAt: connection.lastSyncAt,
    lastErrorMessage: connection.lastErrorMessage,
    lastErrorAt: connection.lastErrorMessage ? connection.lastSyncAt : null,
    syncErrorCount: connection.syncErrorCount,
    rateLimit: {
      used,
      limit: 100,
      resetAt: null,
    },
    circuitBreaker: deriveCircuitBreaker(connection.syncErrorCount),
    hourlyStats: buildHourlyStatsFromLogs(logs),
  };
}

export function marketplaceToRow(c: MarketplaceConnectionDto): UnifiedConnectionRow {
  const kind = marketplaceKind(c.platform);
  return {
    id: c.id,
    kind,
    platform: c.platform,
    name: c.accountLabel ?? c.platform,
    isActive: c.isActive,
    lastSyncAt: c.lastSyncAt,
    syncErrorCount: c.syncErrorCount,
    lastErrorMessage: c.lastErrorMessage,
    syncFrequencyLabel: c.isActive ? 'Otomatik' : '—',
    status: deriveConnectionStatus(
      c.isActive,
      c.syncErrorCount,
      c.lastErrorMessage,
      c.lastSyncAt,
    ),
  };
}

export function erpToRow(
  c: ErpConnectionDto,
  syncFrequencyLabel = '—',
  linkedDocumentsLabel?: string | null,
): UnifiedConnectionRow {
  return {
    id: c.id,
    kind: 'erp',
    platform: c.erpType,
    name: erpConnectionDisplayName(c),
    isActive: c.isActive,
    lastSyncAt: c.lastSyncAt,
    syncErrorCount: c.syncErrorCount,
    lastErrorMessage: c.lastErrorMessage,
    syncFrequencyLabel,
    serverDomain: c.accountLabel ?? null,
    linkedDocumentsLabel: linkedDocumentsLabel ?? null,
    status: deriveConnectionStatus(
      c.isActive,
      c.syncErrorCount,
      c.lastErrorMessage,
      c.lastSyncAt,
    ),
  };
}

const ERP_FREQUENCY_LABELS: Record<string, string> = {
  MANUAL: 'Manuel',
  REALTIME: '5 dk',
  EVERY_5_MIN: '5 dk',
  EVERY_15_MIN: '15 dk',
  EVERY_30_MIN: '30 dk',
  HOURLY: '1 saat',
  EVERY_4_HOURS: '4 saat',
  DAILY: 'Günlük',
};

export function erpSyncScheduleLabel(erpType: string | undefined): string {
  if (erpType === 'BIZIMHESAP') {
    return 'Otomatik (~6 dk, saatte 10 istek)';
  }
  return 'Otomatik (platform)';
}

export function erpSyncFrequencyLabel(frequency: string | undefined): string {
  if (!frequency) {
    return '—';
  }
  return ERP_FREQUENCY_LABELS[frequency] ?? frequency;
}

export function kindLabel(kind: ConnectionKind): string {
  const map: Record<ConnectionKind, string> = {
    marketplace: 'Pazaryeri',
    ecommerce: 'E-ticaret',
    erp: 'ERP',
    cargo: 'Kargo',
  };
  return map[kind];
}

export function statusLabel(status: ConnectionRowStatus): string {
  const map: Record<ConnectionRowStatus, string> = {
    active: 'Aktif',
    warning: 'Uyarı',
    error: 'Hata',
    inactive: 'Pasif',
  };
  return map[status];
}

export function statusBadgeClass(status: ConnectionRowStatus): string {
  const map: Record<ConnectionRowStatus, string> = {
    active: 'border-green-200 bg-green-50 text-green-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    inactive: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return map[status];
}

export function circuitBreakerBadgeClass(state: CircuitBreakerState): string {
  const map: Record<CircuitBreakerState, string> = {
    CLOSED: 'border-green-200 bg-green-50 text-green-800',
    HALF_OPEN: 'border-amber-200 bg-amber-50 text-amber-800',
    OPEN: 'border-red-200 bg-red-50 text-red-800',
  };
  return map[state];
}

export function computeConnectionKpis(rows: UnifiedConnectionRow[]): {
  active: number;
  error: number;
  pending: number;
  total: number;
} {
  let active = 0;
  let error = 0;
  let pending = 0;
  for (const row of rows) {
    if (row.status === 'active') {
      active += 1;
    } else if (row.status === 'error') {
      error += 1;
    } else if (row.status === 'warning') {
      pending += 1;
    }
  }
  return { active, error, pending, total: rows.length };
}
