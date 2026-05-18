import type { OrderStatus } from '@/types/order';

/** i18n key under default `translation` namespace */
export const ORDER_STATUS_I18N_KEY: Record<OrderStatus, string> = {
  NEW: 'orders.new',
  PICKING: 'orders.processing',
  INVOICED: 'orders.invoiced',
  SHIPPED: 'orders.shipped',
  DELIVERED: 'orders.delivered',
  CANCELLED: 'orders.cancelled',
  RETURNED: 'orders.returned',
};
