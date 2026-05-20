import { create } from 'zustand';

export interface PlatformSyncProgress {
  platform: string;
  phase: string;
  current: number;
  total: number;
  updatedAt: number;
}

interface ListingSyncProgressState {
  byPlatform: Record<string, PlatformSyncProgress>;
  setProgress: (payload: Omit<PlatformSyncProgress, 'updatedAt'>) => void;
  clearPlatform: (platform: string) => void;
}

export const useListingSyncProgressStore = create<ListingSyncProgressState>(
  (set) => ({
    byPlatform: {},
    setProgress: (payload) => {
      set((state) => ({
        byPlatform: {
          ...state.byPlatform,
          [payload.platform]: { ...payload, updatedAt: Date.now() },
        },
      }));
    },
    clearPlatform: (platform) => {
      set((state) => {
        const next = { ...state.byPlatform };
        delete next[platform];
        return { byPlatform: next };
      });
    },
  }),
);
