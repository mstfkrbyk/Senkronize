import { NotificationType } from '@prisma/client';

export type InAppNotificationListFilter =
  | 'all'
  | 'unread'
  | 'order'
  | 'stock'
  | 'error';

export type InAppNotificationScope = 'integration' | 'accounting';

const INTEGRATION_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.ORDER_NEW,
  NotificationType.ORDER_STATUS_CHANGED,
  NotificationType.STOCK_LOW,
  NotificationType.STOCK_OUT,
  NotificationType.SYNC_SUCCESS,
  NotificationType.SYNC_ERROR,
  NotificationType.PRICE_UPDATED,
  NotificationType.BUYBOX_WON,
  NotificationType.BUYBOX_LOST,
];

const ACCOUNTING_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.SYSTEM,
  NotificationType.PAYMENT_FAILED,
  NotificationType.SUBSCRIPTION_EXPIRING,
];

export function typesForListFilter(
  filter: InAppNotificationListFilter | undefined,
): NotificationType[] | undefined {
  switch (filter) {
    case 'order':
      return [
        NotificationType.ORDER_NEW,
        NotificationType.ORDER_STATUS_CHANGED,
      ];
    case 'stock':
      return [NotificationType.STOCK_LOW, NotificationType.STOCK_OUT];
    case 'error':
      return [
        NotificationType.SYNC_ERROR,
        NotificationType.PAYMENT_FAILED,
        NotificationType.SUBSCRIPTION_EXPIRING,
      ];
    case 'unread':
    case 'all':
    case undefined:
      return undefined;
    default:
      return undefined;
  }
}

export function typesForScope(
  scope: InAppNotificationScope | undefined,
): NotificationType[] | undefined {
  if (scope === 'integration') {
    return INTEGRATION_NOTIFICATION_TYPES;
  }
  if (scope === 'accounting') {
    return ACCOUNTING_NOTIFICATION_TYPES;
  }
  return undefined;
}

export function intersectNotificationTypes(
  a: NotificationType[] | undefined,
  b: NotificationType[] | undefined,
): NotificationType[] | undefined {
  if (!a && !b) {
    return undefined;
  }
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  const allowed = new Set(b);
  const intersection = a.filter((t) => allowed.has(t));
  return intersection.length > 0 ? intersection : [];
}
