export const WS_EVENTS = {
  ORDER_NEW: 'order:new',
  ORDER_UPDATED: 'order:updated',
  LISTING_SYNCED: 'listing:synced',
  STOCK_ALERT: 'stock:alert',
  PRICE_UPDATED: 'price:updated',
  SYNC_STATUS: 'sync:status',
  NOTIFICATION_NEW: 'notification:new',
  SYNC_TRIGGER: 'sync:trigger',
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
