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
  erpType: string;
  direction: 'push' | 'pull';
  type: 'products' | 'orders' | 'stock';
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

/** Giden webhook teslimatı — webhook-delivery kuyruğu */
export interface WebhookDeliveryJobData {
  endpointId: string;
  deliveryId: string;
  event: string;
  payload: Record<string, unknown>;
}
