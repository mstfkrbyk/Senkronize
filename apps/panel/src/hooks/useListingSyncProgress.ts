import { useEffect } from 'react';

import { useSocket } from '@/hooks/useSocket';
import { useListingSyncProgressStore } from '@/store/listingSyncProgress.store';

interface SyncProgressPayload {
  platform?: string;
  phase?: string;
  current?: number;
  total?: number;
  progress?: number;
}

function parseSyncProgressPayload(data: unknown): SyncProgressPayload | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  return data as SyncProgressPayload;
}

/** `sync.progress` WebSocket olaylarını platform bazlı store'a yazar. */
export function useListingSyncProgressListener(): void {
  const { on } = useSocket();
  const setProgress = useListingSyncProgressStore((s) => s.setProgress);
  const clearPlatform = useListingSyncProgressStore((s) => s.clearPlatform);

  useEffect(() => {
    const unProgress = on('sync.progress', (raw) => {
      const payload = parseSyncProgressPayload(raw);
      if (!payload?.platform) {
        return;
      }
      const total =
        typeof payload.total === 'number' && payload.total > 0
          ? payload.total
          : 100;
      const current =
        typeof payload.current === 'number'
          ? payload.current
          : typeof payload.progress === 'number'
            ? Math.round((payload.progress / 100) * total)
            : 0;
      if (current >= total) {
        clearPlatform(payload.platform);
        return;
      }
      setProgress({
        platform: payload.platform,
        phase: payload.phase ?? 'sync',
        current,
        total,
      });
    });

    const unCompleted = on('sync.completed', (raw) => {
      const payload = parseSyncProgressPayload(raw);
      if (payload?.platform) {
        clearPlatform(payload.platform);
      }
    });

    const unLegacy = on('sync:progress', (raw) => {
      const payload = parseSyncProgressPayload(raw);
      if (!payload?.platform) {
        return;
      }
      const progress =
        typeof payload.progress === 'number' ? payload.progress : 0;
      if (progress >= 100) {
        clearPlatform(payload.platform);
        return;
      }
      setProgress({
        platform: payload.platform,
        phase: 'sync',
        current: progress,
        total: 100,
      });
    });

    return () => {
      unProgress();
      unCompleted();
      unLegacy();
    };
  }, [on, setProgress, clearPlatform]);
}
