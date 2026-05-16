import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType = 'order' | 'stock' | 'system' | 'payment';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface UiState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAllRead: () => void;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebarCollapsed: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      notifications: [],
      addNotification: (partial) =>
        set((s) => {
          const next: Notification = {
            ...partial,
            id: newId(),
            read: false,
            createdAt: new Date().toISOString(),
          };
          return { notifications: [next, ...s.notifications].slice(0, 20) };
        }),
      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),
    }),
    {
      name: 'senkronize-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
