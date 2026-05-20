import type { OrderStatus } from '@/types/order';

/** i18n key under default `translation` namespace */
export const ORDER_STATUS_I18N_KEY: Record<OrderStatus, string> = {
  NEW: 'orders.status.new',
  PICKING: 'orders.status.processing',
  INVOICED: 'orders.status.invoiced',
  SHIPPED: 'orders.status.shipped',
  DELIVERED: 'orders.status.delivered',
  CANCELLED: 'orders.status.cancelled',
  RETURNED: 'orders.status.returned',
};
