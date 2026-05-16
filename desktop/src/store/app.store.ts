import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { HealthStatus, SyncResult, TokenPayload } from '@/lib/tauri';

interface AppState {
  token: TokenPayload | null;
  apiUrl: string;
  localErpBaseUrl: string;
  health: HealthStatus | null;
  syncLogs: SyncResult[];
  isConnected: boolean;
  setToken: (token: TokenPayload | null) => void;
  setApiUrl: (url: string) => void;
  setLocalErpBaseUrl: (url: string) => void;
  setHealth: (health: HealthStatus) => void;
  addSyncLog: (log: SyncResult) => void;
  clearSyncLogs: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      token: null,
      apiUrl: 'https://api.senkronize.com',
      localErpBaseUrl: '',
      health: null,
      syncLogs: [],
      isConnected: false,
      setToken: (token) => set({ token, isConnected: !!token }),
      setApiUrl: (apiUrl) => set({ apiUrl }),
      setLocalErpBaseUrl: (localErpBaseUrl) => set({ localErpBaseUrl }),
      setHealth: (health) => set({ health }),
      addSyncLog: (log) =>
        set((s) => ({ syncLogs: [log, ...s.syncLogs].slice(0, 100) })),
      clearSyncLogs: () => set({ syncLogs: [] }),
    }),
    {
      name: 'senkronize-desktop',
      partialize: (state) => ({
        apiUrl: state.apiUrl,
        localErpBaseUrl: state.localErpBaseUrl,
        syncLogs: state.syncLogs,
      }),
    },
  ),
);
