export interface UsageStatBucket {
  used: number;
  limit: number | null;
}

export interface UsageStats {
  orders: UsageStatBucket;
  marketplaces: UsageStatBucket;
  ecommerce: UsageStatBucket;
  erp: UsageStatBucket;
  users: UsageStatBucket;
  trialDaysLeft: number | null;
}
