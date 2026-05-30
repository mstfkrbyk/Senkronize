import type { InAppNotificationListFilter } from '@/lib/in-app-notifications-api';
import {
  isAccountingOnlyOrg,
  isBundleOrg,
  isIntegrationOnlyOrg,
} from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';
import type { InAppNotification, InAppNotificationType } from '@/store/notifications.store';

export type InAppNotificationProductCategory = 'all' | 'integration' | 'accounting';

const INTEGRATION_NOTIFICATION_TYPES = new Set<InAppNotificationType>([
  'ORDER_NEW',
  'ORDER_STATUS_CHANGED',
  'STOCK_LOW',
  'STOCK_OUT',
  'SYNC_SUCCESS',
  'SYNC_ERROR',
  'PRICE_UPDATED',
  'BUYBOX_WON',
  'BUYBOX_LOST',
]);

const ACCOUNTING_NOTIFICATION_TYPES = new Set<InAppNotificationType>([
  'SYSTEM',
  'PAYMENT_FAILED',
  'SUBSCRIPTION_EXPIRING',
]);

export function isIntegrationNotificationType(
  type: InAppNotificationType,
): boolean {
  return INTEGRATION_NOTIFICATION_TYPES.has(type);
}

export function isAccountingNotificationType(
  type: InAppNotificationType,
): boolean {
  return ACCOUNTING_NOTIFICATION_TYPES.has(type);
}

export function notificationMatchesProductCategory(
  notification: Pick<InAppNotification, 'type'>,
  category: InAppNotificationProductCategory,
): boolean {
  if (category === 'all') {
    return true;
  }
  if (category === 'integration') {
    return isIntegrationNotificationType(notification.type);
  }
  return isAccountingNotificationType(notification.type);
}

export function notificationMatchesListFilter(
  notification: Pick<InAppNotification, 'type' | 'isRead'>,
  filter: InAppNotificationListFilter,
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'unread':
      return !notification.isRead;
    case 'order':
      return (
        notification.type === 'ORDER_NEW' ||
        notification.type === 'ORDER_STATUS_CHANGED'
      );
    case 'stock':
      return notification.type === 'STOCK_LOW' || notification.type === 'STOCK_OUT';
    case 'error':
      return (
        notification.type === 'SYNC_ERROR' ||
        notification.type === 'PAYMENT_FAILED' ||
        notification.type === 'SUBSCRIPTION_EXPIRING'
      );
    default:
      return true;
  }
}

export function resolveNotificationListScope(
  orgProducts: OrgProductLine[] | undefined,
  productCategory: InAppNotificationProductCategory,
): 'integration' | 'accounting' | undefined {
  if (isAccountingOnlyOrg(orgProducts)) {
    return 'accounting';
  }
  if (isIntegrationOnlyOrg(orgProducts)) {
    return productCategory === 'accounting' ? 'accounting' : 'integration';
  }
  if (!isBundleOrg(orgProducts)) {
    return undefined;
  }
  if (productCategory === 'integration') {
    return 'integration';
  }
  if (productCategory === 'accounting') {
    return 'accounting';
  }
  return undefined;
}

export function showNotificationProductCategoryChips(
  orgProducts: OrgProductLine[] | undefined,
): boolean {
  return isBundleOrg(orgProducts);
}

export function buildNotificationFilterOptions(
  orgProducts: OrgProductLine[] | undefined,
): { value: InAppNotificationListFilter; label: string }[] {
  const options: { value: InAppNotificationListFilter; label: string }[] = [
    { value: 'all', label: 'Tümü' },
    { value: 'unread', label: 'Okunmamış' },
  ];
  if (!isAccountingOnlyOrg(orgProducts)) {
    options.push(
      { value: 'order', label: 'Sipariş' },
      { value: 'stock', label: 'Stok' },
    );
  }
  options.push({ value: 'error', label: 'Hata' });
  return options;
}

export const NOTIFICATION_PRODUCT_CATEGORY_OPTIONS: {
  value: InAppNotificationProductCategory;
  label: string;
}[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'integration', label: 'Entegrasyon' },
  { value: 'accounting', label: 'Muhasebe' },
];

export function notificationsPageSubtitle(
  orgProducts: OrgProductLine[] | undefined,
): string {
  if (isAccountingOnlyOrg(orgProducts)) {
    return 'Fatura, ödeme ve sistem bildirimlerinizi yönetin.';
  }
  if (isBundleOrg(orgProducts)) {
    return 'Entegrasyon ve muhasebe bildirimlerinizi kategoriye göre filtreleyin.';
  }
  return 'Sipariş, stok ve senkronizasyon bildirimlerinizi yönetin.';
}
