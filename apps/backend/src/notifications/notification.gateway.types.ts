export interface OrderNewPayload {
  orderId: string;
  platform: string;
  amount: number | string;
  customer: string;
}

export interface OrderStatusChangedPayload {
  orderId: string;
  oldStatus: string;
  newStatus: string;
}

export interface StockLowPayload {
  productId: string;
  sku: string;
  quantity: number;
  threshold: number;
}

export interface StockOutPayload {
  productId: string;
  sku: string;
  platform: string;
}

export interface SyncProgressPayload {
  connectionId: string;
  platform: string;
  phase: string;
  current: number;
  total: number;
}

export interface SyncCompletedPayload {
  connectionId: string;
  platform: string;
  processed: number;
  duration: number;
}

export interface SyncErrorPayload {
  connectionId: string;
  platform: string;
  error: string;
}

export interface BuyBoxLostPayload {
  listingId: string;
  platform: string;
  ourPrice: number | string;
  winnerPrice: number | string;
}

export interface BuyBoxWonPayload {
  listingId: string;
  platform: string;
  price: number | string;
}

export interface InAppNotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
}

export const NOTIFICATION_WS_EVENTS = {
  ORDER_NEW: 'order.new',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  STOCK_LOW: 'stock.low',
  STOCK_OUT: 'stock.out',
  SYNC_PROGRESS: 'sync.progress',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_ERROR: 'sync.error',
  BUYBOX_LOST: 'buybox.lost',
  BUYBOX_WON: 'buybox.won',
  NOTIFICATION: 'notification',
} as const;

export type NotificationWsEventName =
  (typeof NOTIFICATION_WS_EVENTS)[keyof typeof NOTIFICATION_WS_EVENTS];
