export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED';

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
  monthlyOrderLimit: number | null;
  marketplaceLimit: number | null;
  ecommerceLimit: number | null;
  erpLimit: number | null;
  userLimit: number | null;
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
