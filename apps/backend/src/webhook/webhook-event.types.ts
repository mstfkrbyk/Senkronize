export const WEBHOOK_EVENTS = [
  // Sipariş
  'order.created',
  'order.status_changed',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  // Ürün
  'product.created',
  'product.updated',
  'product.deleted',
  // Stok
  'stock.low',
  'stock.out',
  'stock.updated',
  // Fiyat
  'price.changed',
  'buybox.lost',
  'buybox.won',
  // Senkronizasyon
  'sync.completed',
  'sync.failed',
  // Abonelik
  'subscription.upgraded',
  'subscription.cancelled',
  'subscription.expired',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
