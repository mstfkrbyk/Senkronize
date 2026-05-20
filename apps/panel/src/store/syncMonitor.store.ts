import { create } from 'zustand';

export type SyncMonitorEntryStatus = 'running' | 'completed' | 'error';

export interface SyncMonitorEntry {
  key: string;
  connectionId: string;
  platform: string;
  phase: string;
  current: number;
  total: number;
  status: SyncMonitorEntryStatus;
  errorMessage?: string;
  updatedAt: number;
  completedAt?: number;
}

interface SyncMonitorState {
  entries: Record<string, SyncMonitorEntry>;
  upsertRunning: (payload: Omit<SyncMonitorEntry, 'status' | 'updatedAt'>) => void;
  markCompleted: (key: string) => void;
  markError: (key: string, errorMessage: string) => void;
  removeEntry: (key: string) => void;
  retryEntry: (key: string) => void;
}

export const useSyncMonitorStore = create<SyncMonitorState>((set) => ({
  entries: {},
  upsertRunning: (payload) => {
    set((state) => ({
      entries: {
        ...state.entries,
        [payload.key]: {
          ...payload,
          status: 'running',
          updatedAt: Date.now(),
          errorMessage: undefined,
        },
      },
    }));
  },
  markCompleted: (key) => {
    set((state) => {
      const existing = state.entries[key];
      if (!existing) {
        return state;
      }
      return {
        entries: {
          ...state.entries,
          [key]: {
            ...existing,
            status: 'completed',
            current: existing.total,
            completedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  markError: (key, errorMessage) => {
    set((state) => {
      const existing = state.entries[key];
      if (!existing) {
        return state;
      }
      return {
        entries: {
          ...state.entries,
          [key]: {
            ...existing,
            status: 'error',
            errorMessage,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  removeEntry: (key) => {
    set((state) => {
      const next = { ...state.entries };
      delete next[key];
      return { entries: next };
    });
  },
  retryEntry: (key) => {
    set((state) => {
      const existing = state.entries[key];
      if (!existing) {
        return state;
      }
      return {
        entries: {
          ...state.entries,
          [key]: {
            ...existing,
            status: 'running',
            current: 0,
            errorMessage: undefined,
            updatedAt: Date.now(),
            completedAt: undefined,
          },
        },
      };
    });
  },
}));
