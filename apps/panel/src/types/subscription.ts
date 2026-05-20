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

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELING'
  | 'CANCELLED'
  | 'EXPIRED';

export type BillingPeriod = 'MONTHLY' | 'YEARLY';

export type PlanTier = 'BASLANGIC' | 'GELISIM' | 'PRO' | 'KURUMSAL';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface SubscriptionRecord {
  id: string;
  organizationId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  nextBillingAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  subscriptionEndsAt?: string | null;
  billingPeriod?: BillingPeriod | null;
  monthlyOrderLimit: number | null;
  marketplaceLimit: number | null;
  ecommerceLimit: number | null;
  erpLimit: number | null;
  userLimit: number | null;
  canceledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  plan: PlanTier;
  createdAt: string;
  periodStart: string | null;
  periodEnd: string | null;
}

/** @deprecated Payment ile aynı — geriye dönük uyumluluk */
export type PaymentRecord = Payment;

export interface PaymentsPage {
  items: Payment[];
  total: number;
  page: number;
  limit: number;
}

export interface PlanUpgradeResult {
  message: string;
  prorationAmountTry?: number;
  checkoutUrl?: string;
  conversationId?: string;
}
