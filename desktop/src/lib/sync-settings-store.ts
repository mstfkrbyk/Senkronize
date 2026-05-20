export type SyncIntervalOption = 5 | 15 | 30 | 60 | null;

export interface SyncSettings {
  intervalMinutes: SyncIntervalOption;
  syncStock: boolean;
  syncOrder: boolean;
  syncProduct: boolean;
  syncPrice: boolean;
  deltaOnly: boolean;
  autoSyncOnStartup: boolean;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  dailySummaryHour: number | null;
}

const STORAGE_KEY = 'senkronize-sync-settings';

const DEFAULTS: SyncSettings = {
  intervalMinutes: 15,
  syncStock: true,
  syncOrder: true,
  syncProduct: true,
  syncPrice: false,
  deltaOnly: false,
  autoSyncOnStartup: false,
  notifyOnComplete: true,
  notifyOnError: true,
  dailySummaryHour: null,
};

export function loadSyncSettings(): SyncSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULTS };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULTS };
    }
    return { ...DEFAULTS, ...(parsed as Partial<SyncSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSyncSettings(settings: SyncSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function computeNextSyncAt(
  lastSyncIso: string | null,
  intervalMinutes: SyncIntervalOption,
  schedulerRunning: boolean,
): Date | null {
  if (!schedulerRunning || intervalMinutes === null) {
    return null;
  }
  const base = lastSyncIso ? new Date(lastSyncIso) : new Date();
  if (Number.isNaN(base.getTime())) {
    return new Date(Date.now() + intervalMinutes * 60_000);
  }
  return new Date(base.getTime() + intervalMinutes * 60_000);
}
