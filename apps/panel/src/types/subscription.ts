export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PlanTier = 'BASLANGIC' | 'GELISIM' | 'PRO' | 'KURUMSAL';

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

export interface PaymentRecord {
  id: string;
  organizationId: string;
  amount: number;
  currency: string;
  status: string;
  paytrOrderId: string;
  plan: PlanTier;
  periodStart: string | null;
  periodEnd: string | null;
  failReason: string | null;
  createdAt: string;
}

export interface PaymentsPage {
  items: PaymentRecord[];
  total: number;
  page: number;
  limit: number;
}
