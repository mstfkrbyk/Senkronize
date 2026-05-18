import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { HealthStatus, SyncResult, TokenPayload } from '@/lib/tauri';

export type SidebarNavTarget = 'settings' | null;

interface AppState {
  token: TokenPayload | null;
  apiUrl: string;
  localErpBaseUrl: string;
  pendingSidebarNav: SidebarNavTarget;
  health: HealthStatus | null;
  syncLogs: SyncResult[];
  isConnected: boolean;
  setToken: (token: TokenPayload | null) => void;
  setApiUrl: (url: string) => void;
  setLocalErpBaseUrl: (url: string) => void;
  setPendingSidebarNav: (target: SidebarNavTarget) => void;
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
      pendingSidebarNav: null,
      health: null,
      syncLogs: [],
      isConnected: false,
      setToken: (token) => set({ token, isConnected: !!token }),
      setApiUrl: (apiUrl) => set({ apiUrl }),
      setLocalErpBaseUrl: (localErpBaseUrl) => set({ localErpBaseUrl }),
      setPendingSidebarNav: (pendingSidebarNav) => set({ pendingSidebarNav }),
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
