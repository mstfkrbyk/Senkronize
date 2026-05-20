export enum WebhookEvent {
  // Sipariş
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_DELIVERED = 'order.delivered',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_RETURNED = 'order.returned',
  // Ürün/Stok
  PRODUCT_CREATED = 'product.created',
  PRODUCT_UPDATED = 'product.updated',
  STOCK_LOW = 'stock.low',
  STOCK_OUT = 'stock.out',
  STOCK_UPDATED = 'stock.updated',
  // Fiyat
  PRICE_CHANGED = 'price.changed',
  BUYBOX_WON = 'buybox.won',
  BUYBOX_LOST = 'buybox.lost',
  // Sistem
  SYNC_COMPLETED = 'sync.completed',
  SYNC_FAILED = 'sync.failed',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
}

export const WEBHOOK_EVENT_VALUES = Object.values(WebhookEvent) as WebhookEvent[];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  [WebhookEvent.ORDER_CREATED]: 'Sipariş oluşturuldu',
  [WebhookEvent.ORDER_UPDATED]: 'Sipariş güncellendi',
  [WebhookEvent.ORDER_SHIPPED]: 'Sipariş kargolandı',
  [WebhookEvent.ORDER_DELIVERED]: 'Sipariş teslim edildi',
  [WebhookEvent.ORDER_CANCELLED]: 'Sipariş iptal edildi',
  [WebhookEvent.ORDER_RETURNED]: 'Sipariş iade edildi',
  [WebhookEvent.PRODUCT_CREATED]: 'Ürün oluşturuldu',
  [WebhookEvent.PRODUCT_UPDATED]: 'Ürün güncellendi',
  [WebhookEvent.STOCK_LOW]: 'Stok düşük',
  [WebhookEvent.STOCK_OUT]: 'Stok tükendi',
  [WebhookEvent.STOCK_UPDATED]: 'Stok güncellendi',
  [WebhookEvent.PRICE_CHANGED]: 'Fiyat değişti',
  [WebhookEvent.BUYBOX_WON]: 'BuyBox kazanıldı',
  [WebhookEvent.BUYBOX_LOST]: 'BuyBox kaybedildi',
  [WebhookEvent.SYNC_COMPLETED]: 'Senkronizasyon tamamlandı',
  [WebhookEvent.SYNC_FAILED]: 'Senkronizasyon başarısız',
  [WebhookEvent.SUBSCRIPTION_RENEWED]: 'Abonelik yenilendi',
  [WebhookEvent.SUBSCRIPTION_CANCELLED]: 'Abonelik iptal edildi',
};
