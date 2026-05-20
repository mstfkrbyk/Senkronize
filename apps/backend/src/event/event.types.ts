export const WS_EVENTS = {
  ORDER_NEW: 'order:new',
  ORDER_UPDATED: 'order:updated',
  LISTING_SYNCED: 'listing:synced',
  STOCK_ALERT: 'stock:alert',
  STOCK_UPDATED: 'stock:updated',
  PRICE_UPDATED: 'price:updated',
  SYNC_STATUS: 'sync:status',
  SYNC_COMPLETED: 'sync:completed',
  SYNC_ERROR: 'sync:error',
  NOTIFICATION_NEW: 'notification:new',
  SYNC_TRIGGER: 'sync:trigger',
  DASHBOARD_UPDATE: 'dashboard:update',
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
