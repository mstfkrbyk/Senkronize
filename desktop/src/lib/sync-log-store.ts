import type { ErpKind } from '@/lib/erp-bridge-store';

export type SyncLogType = 'STOCK' | 'ORDER' | 'PRODUCT' | 'PRICE';
export type SyncLogStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'RUNNING';

export interface SyncLog {
  id: string;
  timestamp: string;
  type: SyncLogType;
  status: SyncLogStatus;
  itemCount: number;
  duration: number;
  erpType?: ErpKind | string;
  error?: string;
  affectedRecords?: string[];
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
  const typeOk =
    v.type === 'STOCK' ||
    v.type === 'ORDER' ||
    v.type === 'PRODUCT' ||
    v.type === 'PRICE';
  const statusOk =
    v.status === 'SUCCESS' ||
    v.status === 'FAILED' ||
    v.status === 'PARTIAL' ||
    v.status === 'RUNNING';
  return (
    typeof v.id === 'string' &&
    typeof v.timestamp === 'string' &&
    typeOk &&
    statusOk &&
    typeof v.itemCount === 'number' &&
    typeof v.duration === 'number'
  );
}

export function listSyncLogs(): SyncLog[] {
  return readRaw().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function appendSyncLog(
  entry: Omit<SyncLog, 'id' | 'timestamp'> & { timestamp?: string },
): SyncLog {
  const log: SyncLog = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    type: entry.type,
    status: entry.status,
    itemCount: entry.itemCount,
    duration: entry.duration,
    erpType: entry.erpType,
    error: entry.error,
    affectedRecords: entry.affectedRecords,
  };
  const next = [log, ...readRaw()].slice(0, MAX_LOGS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return log;
}

export function updateSyncLog(id: string, patch: Partial<Omit<SyncLog, 'id'>>): SyncLog | null {
  const logs = readRaw();
  const idx = logs.findIndex((l) => l.id === id);
  if (idx < 0) {
    return null;
  }
  const updated: SyncLog = { ...logs[idx], ...patch };
  logs[idx] = updated;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  return updated;
}

export function clearSyncLogs(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportSyncLogsCsv(logs: SyncLog[]): string {
  const header = 'tarih,erp_tipi,islem,durum,kayit_sayisi,sure_ms,hata,etkilenen_kayitlar';
  const rows = logs.map((l) => {
    const err = l.error ? `"${l.error.replace(/"/g, '""')}"` : '';
    const affected = l.affectedRecords?.length
      ? `"${l.affectedRecords.join('; ').replace(/"/g, '""')}"`
      : '';
    return `${l.timestamp},${l.erpType ?? ''},${l.type},${l.status},${l.itemCount},${l.duration},${err},${affected}`;
  });
  return [header, ...rows].join('\n');
}
