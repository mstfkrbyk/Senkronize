import { api } from '@/lib/api';
import type { InAppNotificationProductCategory } from '@/lib/in-app-notification-categories';
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

export type InAppNotificationListScope = 'integration' | 'accounting';

interface NotificationsPageApiPayload {
  data?: unknown[];
  items?: unknown[];
  total: number;
  page: number;
  limit?: number;
  pageSize?: number;
}

function normalizeNotificationsPagePayload(
  payload: NotificationsPageApiPayload,
): {
  data: InAppNotification[];
  total: number;
  page: number;
  limit: number;
} {
  const rawRows = payload.data ?? payload.items ?? [];
  const parsed = rawRows
    .map((raw) => parseInAppNotification(raw))
    .filter((n): n is InAppNotification => n !== null);
  return {
    data: parsed,
    total: payload.total,
    page: payload.page,
    limit: payload.limit ?? payload.pageSize ?? parsed.length,
  };
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function fetchNotificationsPage(params: {
  page: number;
  limit: number;
  filter: InAppNotificationListFilter;
  scope?: InAppNotificationListScope;
  productCategory?: InAppNotificationProductCategory;
}): Promise<{
  data: InAppNotification[];
  total: number;
  page: number;
  limit: number;
}> {
  const scope =
    params.scope ??
    (params.productCategory === 'integration'
      ? 'integration'
      : params.productCategory === 'accounting'
        ? 'accounting'
        : undefined);

  const { data } = await api.get<NotificationsPageApiPayload>('/notifications', {
    params: {
      page: params.page,
      limit: params.limit,
      filter: params.filter === 'all' ? undefined : params.filter,
      unreadOnly: params.filter === 'unread' ? true : undefined,
      scope,
    },
  });
  return normalizeNotificationsPagePayload(data);
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
