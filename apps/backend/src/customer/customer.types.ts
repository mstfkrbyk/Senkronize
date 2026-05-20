export type CustomerSegmentKey = 'VIP' | 'sadik' | 'yeni' | 'risk' | 'kayip';

export interface CustomerSummary {
  total: number;
  newThisMonth: number;
  highValue: number;
  churned: number;
}

export interface CustomerSegmentStats {
  count: number;
  totalRevenue: string;
}

export type CustomerSegmentsSummary = Record<
  CustomerSegmentKey,
  CustomerSegmentStats
>;

export interface SerializedCustomer {
  id: string;
  organizationId: string;
  externalId: string | null;
  platform: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string;
  totalOrders: number;
  totalSpent: string;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  segments: CustomerSegmentKey[];
}

export interface CustomerOrderHistoryItem {
  id: string;
  platformOrderId: string;
  platform: string;
  status: string;
  totalAmount: string;
  currency: string;
  platformCreatedAt: string;
}

export interface CustomerDetail extends SerializedCustomer {
  orders: CustomerOrderHistoryItem[];
  averageOrderValue: string;
}
