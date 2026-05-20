export type SyncLogType = 'STOCK' | 'ORDER' | 'PRODUCT';
export type SyncLogStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL';

export interface SyncLog {
  id: string;
  timestamp: string;
  type: SyncLogType;
  status: SyncLogStatus;
  itemCount: number;
  duration: number;
  error?: string;
}

const STORAGE_KEY = 'senkronize-erp-sync-logs';
const MAX_LOGS = 500;

function readRaw(): SyncLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isSyncLog);
  } catch {
    return [];
  }
}

function isSyncLog(value: unknown): value is SyncLog {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.timestamp === 'string' &&
    (v.type === 'STOCK' || v.type === 'ORDER' || v.type === 'PRODUCT') &&
    (v.status === 'SUCCESS' || v.status === 'FAILED' || v.status === 'PARTIAL') &&
    typeof v.itemCount === 'number' &&
    typeof v.duration === 'number'
  );
}

export function listSyncLogs(): SyncLog[] {
  return readRaw().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function appendSyncLog(entry: Omit<SyncLog, 'id' | 'timestamp'> & { timestamp?: string }): SyncLog {
  const log: SyncLog = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    type: entry.type,
    status: entry.status,
    itemCount: entry.itemCount,
    duration: entry.duration,
    error: entry.error,
  };
  const next = [log, ...readRaw()].slice(0, MAX_LOGS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return log;
}

export function clearSyncLogs(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportSyncLogsCsv(logs: SyncLog[]): string {
  const header = 'tarih,tur,durum,oge_sayisi,sure_ms,hata';
  const rows = logs.map((l) => {
    const err = l.error ? `"${l.error.replace(/"/g, '""')}"` : '';
    return `${l.timestamp},${l.type},${l.status},${l.itemCount},${l.duration},${err}`;
  });
  return [header, ...rows].join('\n');
}
