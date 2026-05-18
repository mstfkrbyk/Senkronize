import { create } from 'zustand';

export const IN_APP_NOTIFICATION_TYPES = [
  'ORDER_NEW',
  'ORDER_STATUS_CHANGED',
  'STOCK_LOW',
  'STOCK_OUT',
  'SYNC_SUCCESS',
  'SYNC_ERROR',
  'PRICE_UPDATED',
  'BUYBOX_WON',
  'BUYBOX_LOST',
  'SUBSCRIPTION_EXPIRING',
  'PAYMENT_FAILED',
  'SYSTEM',
] as const;

export type InAppNotificationType = (typeof IN_APP_NOTIFICATION_TYPES)[number];

export interface InAppNotification {
  id: string;
  organizationId: string;
  userId: string | null;
  type: InAppNotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  metadata: unknown;
  createdAt: string;
}

function isInAppNotificationType(v: unknown): v is InAppNotificationType {
  return (
    typeof v === 'string' &&
    (IN_APP_NOTIFICATION_TYPES as readonly string[]).includes(v)
  );
}

export function parseInAppNotification(data: unknown): InAppNotification | null {
  if (data === null || typeof data !== 'object') {
    return null;
  }
  const o = data as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.title !== 'string' || typeof o.message !== 'string') {
    return null;
  }
  if (typeof o.organizationId !== 'string') {
    return null;
  }
  const type = o.type;
  if (!isInAppNotificationType(type)) {
    return null;
  }
  if (typeof o.isRead !== 'boolean' || typeof o.createdAt !== 'string') {
    return null;
  }
  return {
    id: o.id,
    organizationId: o.organizationId,
    userId: typeof o.userId === 'string' ? o.userId : null,
    type,
    title: o.title,
    message: o.message,
    link: typeof o.link === 'string' ? o.link : null,
    isRead: o.isRead,
    readAt: typeof o.readAt === 'string' ? o.readAt : null,
    metadata: o.metadata,
    createdAt: o.createdAt,
  };
}

interface NotificationsState {
  notifications: InAppNotification[];
  unreadCount: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  setNotifications: (notifs: InAppNotification[]) => void;
  setUnreadCount: (count: number) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notif: InAppNotification) => void;
  removeNotification: (id: string) => void;
  clearLocal: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  setOpen: (isOpen) => set({ isOpen }),
  setNotifications: (notifications) => set({ notifications }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  markAsRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
      ),
      unreadCount: Math.max(
        0,
        s.unreadCount - (s.notifications.find((n) => n.id === id && !n.isRead) ? 1 : 0),
      ),
    })),
  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    })),
  addNotification: (notif) =>
    set((s) => {
      if (s.notifications.some((n) => n.id === notif.id)) {
        return s;
      }
      const next = [notif, ...s.notifications].slice(0, 50);
      return {
        notifications: next,
        unreadCount: notif.isRead ? s.unreadCount : s.unreadCount + 1,
      };
    }),
  removeNotification: (id) =>
    set((s) => {
      const removed = s.notifications.find((n) => n.id === id);
      const notifications = s.notifications.filter((n) => n.id !== id);
      return {
        notifications,
        unreadCount:
          removed && !removed.isRead
            ? Math.max(0, s.unreadCount - 1)
            : s.unreadCount,
      };
    }),
  clearLocal: () => set({ notifications: [], unreadCount: 0 }),
}));
