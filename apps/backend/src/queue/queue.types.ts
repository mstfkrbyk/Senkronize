/** marketplace-push job payload */
export interface MarketplacePushJobData {
  organizationId: string;
  platform: string;
  type: 'stock' | 'price' | 'listing';
  resourceIds: string[];
  payload?: Record<string, unknown>;
}

/** marketplace-pull job payload */
export interface MarketplacePullJobData {
  organizationId: string;
  platform: string;
  type: 'orders' | 'stock' | 'listings';
  since?: string;
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

/** pricing-engine job payload */
export interface PricingRunRulesJobData {
  organizationId: string;
}
