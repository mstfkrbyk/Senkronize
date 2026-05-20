import {
  WEBHOOK_EVENTS,
  type WebhookEvent as WebhookEventType,
} from './webhook-event.types';

/** Doğrulama ve panel için desteklenen giden olay listesi */
export const WEBHOOK_EVENT_VALUES: WebhookEventType[] = [...WEBHOOK_EVENTS];

/** Kod içi sabitler — `WebhookEvent.ORDER_CREATED` */
export const WebhookEvent = {
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
  STOCK_LOW: 'stock.low',
  STOCK_OUT: 'stock.out',
  STOCK_UPDATED: 'stock.updated',
  PRICE_CHANGED: 'price.changed',
  BUYBOX_WON: 'buybox.won',
  BUYBOX_LOST: 'buybox.lost',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_FAILED: 'sync.failed',
  SUBSCRIPTION_UPGRADED: 'subscription.upgraded',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',
} as const satisfies Record<string, WebhookEventType>;

export type WebhookEventId = (typeof WebhookEvent)[keyof typeof WebhookEvent];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  'order.created': 'Sipariş oluşturuldu',
  'order.status_changed': 'Sipariş durumu değişti',
  'order.shipped': 'Sipariş kargolandı',
  'order.delivered': 'Sipariş teslim edildi',
  'order.cancelled': 'Sipariş iptal edildi',
  'product.created': 'Ürün oluşturuldu',
  'product.updated': 'Ürün güncellendi',
  'product.deleted': 'Ürün silindi',
  'stock.low': 'Stok düşük',
  'stock.out': 'Stok tükendi',
  'stock.updated': 'Stok güncellendi',
  'price.changed': 'Fiyat değişti',
  'buybox.won': 'BuyBox kazanıldı',
  'buybox.lost': 'BuyBox kaybedildi',
  'sync.completed': 'Senkronizasyon tamamlandı',
  'sync.failed': 'Senkronizasyon başarısız',
  'subscription.upgraded': 'Abonelik yükseltildi',
  'subscription.cancelled': 'Abonelik iptal edildi',
  'subscription.expired': 'Abonelik süresi doldu',
};
