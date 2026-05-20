import { useEffect } from 'react';

import { useSocket } from '@/hooks/useSocket';
import { useSyncMonitorStore } from '@/store/syncMonitor.store';

interface SyncProgressPayload {
  connectionId?: string;
  platform?: string;
  phase?: string;
  current?: number;
  total?: number;
  progress?: number;
}

interface SyncErrorPayload {
  connectionId?: string;
  platform?: string;
  error?: string;
  message?: string;
}

function parseObject(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  return data as Record<string, unknown>;
}

function monitorKey(connectionId: string | undefined, platform: string): string {
  return connectionId ?? platform;
}

function parseProgressPayload(data: unknown): SyncProgressPayload | null {
  const obj = parseObject(data);
  if (!obj?.platform || typeof obj.platform !== 'string') {
    return null;
  }
  return {
    connectionId: typeof obj.connectionId === 'string' ? obj.connectionId : undefined,
    platform: obj.platform,
    phase: typeof obj.phase === 'string' ? obj.phase : undefined,
    current: typeof obj.current === 'number' ? obj.current : undefined,
    total: typeof obj.total === 'number' ? obj.total : undefined,
    progress: typeof obj.progress === 'number' ? obj.progress : undefined,
  };
}

function parseErrorPayload(data: unknown): SyncErrorPayload | null {
  const obj = parseObject(data);
  if (!obj?.platform || typeof obj.platform !== 'string') {
    return null;
  }
  const error =
    typeof obj.error === 'string'
      ? obj.error
      : typeof obj.message === 'string'
        ? obj.message
        : undefined;
  return {
    connectionId: typeof obj.connectionId === 'string' ? obj.connectionId : undefined,
    platform: obj.platform,
    error,
  };
}

/** Aktif sync işlemlerini WebSocket olaylarından izler. */
export function useSyncMonitorListener(): void {
  const { on } = useSocket();
  const upsertRunning = useSyncMonitorStore((s) => s.upsertRunning);
  const markCompleted = useSyncMonitorStore((s) => s.markCompleted);
  const markError = useSyncMonitorStore((s) => s.markError);

  useEffect(() => {
    const handleProgress = (raw: unknown): void => {
      const payload = parseProgressPayload(raw);
      if (!payload?.platform) {
        return;
      }
      const total =
        typeof payload.total === 'number' && payload.total > 0 ? payload.total : 100;
      const current =
        typeof payload.current === 'number'
          ? payload.current
          : typeof payload.progress === 'number'
            ? Math.round((payload.progress / 100) * total)
            : 0;
      const key = monitorKey(payload.connectionId, payload.platform);
      if (current >= total) {
        markCompleted(key);
        return;
      }
      upsertRunning({
        key,
        connectionId: payload.connectionId ?? key,
        platform: payload.platform,
        phase: payload.phase ?? 'sync',
        current,
        total,
      });
    };

    const handleCompleted = (raw: unknown): void => {
      const payload = parseProgressPayload(raw);
      if (!payload?.platform) {
        return;
      }
      markCompleted(monitorKey(payload.connectionId, payload.platform));
    };

    const handleError = (raw: unknown): void => {
      const payload = parseErrorPayload(raw);
      if (!payload?.platform) {
        return;
      }
      markError(
        monitorKey(payload.connectionId, payload.platform),
        payload.error ?? 'Senkronizasyon başarısız oldu',
      );
    };

    const unProgress = on('sync.progress', handleProgress);
    const unLegacy = on('sync:progress', handleProgress);
    const unCompleted = on('sync.completed', handleCompleted);
    const unLegacyCompleted = on('sync:completed', handleCompleted);
    const unError = on('sync.error', handleError);

    return () => {
      unProgress();
      unLegacy();
      unCompleted();
      unLegacyCompleted();
      unError();
    };
  }, [on, upsertRunning, markCompleted, markError]);
}

/** Tamamlanan kayıtları kısa süre sonra temizler. */
export function useSyncMonitorCleanup(): void {
  const entries = useSyncMonitorStore((s) => s.entries);
  const removeEntry = useSyncMonitorStore((s) => s.removeEntry);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = Date.now();
    for (const entry of Object.values(entries)) {
      if (entry.status === 'completed' && entry.completedAt) {
        const remaining = 5000 - (now - entry.completedAt);
        if (remaining <= 0) {
          removeEntry(entry.key);
        } else {
          timers.push(
            setTimeout(() => {
              removeEntry(entry.key);
            }, remaining),
          );
        }
      }
    }
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [entries, removeEntry]);
}
