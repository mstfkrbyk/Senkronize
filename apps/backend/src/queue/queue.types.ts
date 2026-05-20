/** marketplace-push job payload */
export interface MarketplacePushJobData {
  organizationId: string;
  platform: string;
  type: 'stock' | 'price' | 'listing' | 'return-action' | 'order-cancel';
  resourceIds: string[];
  payload?: Record<string, unknown>;
}

/** marketplace-pull job payload */
export interface MarketplacePullJobData {
  organizationId: string;
  platform: string;
  type: 'orders' | 'stock' | 'listings' | 'returns';
  since?: string;
  connectionId?: string;
}

/** erp-sync job payload */
export interface ErpSyncJobData {
  organizationId: string;
  erpConnectionId: string;
  erpType: string;
  direction: 'push' | 'pull';
  type: 'products' | 'orders' | 'stock' | 'invoices' | 'customers';
  /** push-order-invoice işi için */
  orderId?: string;
  /** push-stock-to-erp işi için */
  barcode?: string;
  quantity?: number;
}

/** notification-dispatch job payload */
export interface NotificationJobData {
  organizationId: string;
  userId?: string;
  channel: 'email' | 'sms' | 'push' | 'inapp';
  template: string;
  payload: Record<string, unknown>;
}

/** Trendyol webhook işleme — notification-dispatch kuyruğu */
export interface TrendyolWebhookJobData {
  webhookEventId: string;
}

/** WebhookLog tabanlı işleme — notification-dispatch kuyruğu */
export interface WebhookLogJobData {
  webhookLogId: string;
}

export type NotificationDispatchJobData =
  | TrendyolWebhookJobData
  | WebhookLogJobData;

/** pricing-engine job payload */
export interface PricingRunRulesJobData {
  organizationId: string;
}

/** image-upload job payload */
export interface ImageUploadFromUrlJobData {
  organizationId: string;
  imageUrl: string;
  resourceType: 'listing' | 'product';
  resourceId: string;
}

/** image-sync — pazaryeri URL → buffer → R2 → ürün imageUrls */
export interface ImageSyncJobData {
  organizationId: string;
  productId: string;
  imageUrl: string;
}

/** listing-sync — tek ürün platform push */
export interface ListingSyncPushProductJobData {
  orgId: string;
  productId: string;
  platform: string;
}

/** listing-sync — barkod bazlı stok push */
export interface ListingSyncStockJobData {
  orgId: string;
  barcode: string;
  stock: number;
}

/** listing-sync — seçili listing fiyat/stok push */
export interface ListingSyncPriceJobData {
  orgId: string;
  listingIds: string[];
}

/** listing-sync — platform bazlı toplu stok/fiyat push */
export interface ListingSyncBatchUpdate {
  barcode: string;
  stock?: number;
  price?: number;
  listPrice?: number;
  listingId?: string;
}

export interface ListingSyncBatchJobData {
  orgId: string;
  platform: string;
  updates: ListingSyncBatchUpdate[];
  /** DLQ gece yeniden denemesi — ikinci başarısızlıkta AnomalyLog tetiklenir */
  dlqReplay?: boolean;
  dlqReplayCount?: number;
}

/** dead-letter kuyruğu — başarısız iş yükü */
export interface DeadLetterJobData {
  sourceQueue: string;
  jobName: string;
  payload: unknown;
  errorMessage: string;
  attemptsMade: number;
  organizationId?: string;
  failedAt: string;
  dlqReplayCount: number;
}

/** data-import — migration wizard toplu içe aktarma */
export interface DataImportJobData {
  sessionId: string;
  organizationId: string;
}

/** Giden webhook teslimatı — webhook-delivery kuyruğu */
export interface WebhookDeliveryJobData {
  endpointId: string;
  deliveryId: string;
  event: string;
  payload: Record<string, unknown>;
}
