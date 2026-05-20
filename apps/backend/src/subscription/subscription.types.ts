import type { PlanTier } from '@prisma/client';

export interface UsageStatBucket {
  used: number;
  limit: number | null;
}

export interface UsageOverview {
  plan: PlanTier;
  usage: {
    marketplaces: UsageStatBucket;
    products: UsageStatBucket;
    orders: UsageStatBucket;
    users: UsageStatBucket;
    warehouses: UsageStatBucket;
    apiCallsToday: UsageStatBucket;
  };
  renewsAt: string | null;
  daysLeft: number | null;
  trialDaysLeft: number | null;
}

/** @deprecated UsageOverview kullanın */
export interface UsageStats {
  connections: UsageStatBucket;
  products: UsageStatBucket;
  orders: UsageStatBucket;
  apiKeys: UsageStatBucket;
  marketplaces: UsageStatBucket;
  ecommerce: UsageStatBucket;
  erp: UsageStatBucket;
  users: UsageStatBucket;
  warehouses: UsageStatBucket;
  apiCallsToday: UsageStatBucket;
  trialDaysLeft: number | null;
}

export interface PlanUpgradeRequestResult {
  message: string;
  prorationAmountTry?: number;
  checkoutUrl?: string;
  conversationId?: string;
}

export interface CheckoutUrlResult {
  checkoutUrl: string;
  conversationId: string;
  token?: string;
}
