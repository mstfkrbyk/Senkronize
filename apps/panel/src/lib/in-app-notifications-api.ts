import { api } from '@/lib/api';
import {
  parseInAppNotification,
  type InAppNotification,
} from '@/store/notifications.store';

export type InAppNotificationListFilter =
  | 'all'
  | 'unread'
  | 'order'
  | 'stock'
  | 'error';

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function fetchNotificationsPage(params: {
  page: number;
  limit: number;
  filter: InAppNotificationListFilter;
}): Promise<{
  data: InAppNotification[];
  total: number;
  page: number;
  limit: number;
}> {
  const { data } = await api.get<{
    data: unknown[];
    total: number;
    page: number;
    limit: number;
  }>('/notifications', {
    params: {
      page: params.page,
      limit: params.limit,
      filter: params.filter,
    },
  });
  const parsed = data.data
    .map((raw) => parseInAppNotification(raw))
    .filter((n): n is InAppNotification => n !== null);
  return {
    data: parsed,
    total: data.total,
    page: data.page,
    limit: data.limit,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/mark-all-read');
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

export async function deleteAllNotifications(): Promise<number> {
  const { data } = await api.delete<{ deleted: number }>('/notifications/all');
  return data.deleted;
}
