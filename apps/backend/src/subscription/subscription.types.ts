export interface UsageStatBucket {
  used: number;
  limit: number | null;
}

export interface UsageStats {
  connections: UsageStatBucket;
  products: UsageStatBucket;
  orders: UsageStatBucket;
  apiKeys: UsageStatBucket;
  /** @deprecated connections ile aynı — geriye dönük uyumluluk */
  marketplaces: UsageStatBucket;
  ecommerce: UsageStatBucket;
  erp: UsageStatBucket;
  users: UsageStatBucket;
  trialDaysLeft: number | null;
}

export interface PlanUpgradeRequestResult {
  message: string;
}
