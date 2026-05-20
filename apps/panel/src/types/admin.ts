import type { OrgPlanTier } from '@/types/auth';

export type SubStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface DailySignupPoint {
  date: string;
  count: number;
}

export interface PlanCountEntry {
  plan: OrgPlanTier;
  count: number;
}

export interface AdminPlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  inactiveOrganizations: number;
  totalUsers: number;
  planDistribution: PlanCountEntry[];
  trialActiveOrganizations: number;
  newRegistrationsLast30Days: number;
  ordersThisMonthCount: number;
  activeMarketplaceConnections: number;
  platformHealthScore: number;
  dailyNewRegistrations: DailySignupPoint[];
}

export interface RevenuePlanShare {
  plan: OrgPlanTier;
  monthlyRevenueKurus: number;
  organizationCount: number;
}

export interface RevenueMonthPoint {
  monthKey: string;
  revenueKurus: number;
}

export interface AdminRevenueStats {
  mrrKurus: number;
  projectedArrKurus: number;
  planRevenueDistribution: RevenuePlanShare[];
  last12MonthsRevenue: RevenueMonthPoint[];
}

export interface AdminOrgListResponse {
  orgs: AdminOrganizationRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminOrganizationRow {
  id: string;
  name: string;
  slug: string;
  taxNumber: string | null;
  suspended: boolean;
  createdAt: string;
  subscription: {
    plan: OrgPlanTier;
    status: SubStatus;
    trialEndsAt: string | null;
  } | null;
  _count: {
    users: number;
    marketplaceConnections: number;
    orders: number;
  };
  lastActivityAt: string | null;
}

export interface AdminActivityItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorUserId: string;
  actorOrgId: string;
  impersonatedOrgId: string | null;
  createdAt: string;
}

export interface AdminPlatformHealthRow {
  platform: string;
  activeConnections: number;
  errorRate24h: number;
  averageSyncDurationMs: number | null;
  lastSyncAt: string | null;
}

export interface AdminHealthStats {
  platforms: AdminPlatformHealthRow[];
}

export interface AdminGrowthMetrics {
  newOrganizations: number;
  activeOrganizations: number;
  churnedOrganizations: number;
  revenueGrowth: number;
  churnRate: number;
  mrrKurus: number;
  arrKurus: number;
  mrr: number;
  arr: number;
}

export interface AdminPlatformUsageItem {
  type: 'marketplace' | 'erp' | 'feature';
  key: string;
  label: string;
  count: number;
}

export interface AdminCohortRetentionCell {
  monthOffset: number;
  monthKey: string;
  rate: number;
}

export interface AdminCohortData {
  cohortMonth: string;
  cohortSize: number;
  retention: AdminCohortRetentionCell[];
}

export interface AdminMrrHistoryPoint {
  monthKey: string;
  mrrKurus: number;
  newOrganizations: number;
  activeOrganizations: number;
}

export interface AdminOrgDetailUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminOrgDetailConnection {
  id: string;
  platform: string;
  isActive: boolean;
  lastSyncAt: string | null;
  syncErrorCount: number;
  lastErrorAt: string | null;
}

export interface AdminOrgDetailOrder {
  id: string;
  platform: string;
  platformOrderId: string;
  status: string;
  customerName: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
}

export interface AdminOrgDetailAuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorUserId: string;
  actorOrgId: string;
  impersonatedOrgId: string | null;
  createdAt: string;
}

export interface AdminOrgDetailPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  plan: OrgPlanTier;
  createdAt: string;
}

export interface AdminOrganizationDetailResponse {
  organization: {
    id: string;
    slug: string;
    name: string;
    taxNumber: string | null;
    taxOffice: string | null;
    address: string | null;
    city: string | null;
    website: string | null;
    type: string;
    suspended: boolean;
    onboardingCompleted: boolean;
    createdAt: string;
  };
  subscription: {
    plan: OrgPlanTier;
    status: SubStatus;
    trialEndsAt: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextBillingAt: string | null;
  } | null;
  users: AdminOrgDetailUser[];
  marketplaceConnections: AdminOrgDetailConnection[];
  recentOrders: AdminOrgDetailOrder[];
  recentAuditLogs: AdminOrgDetailAuditEntry[];
  payments: AdminOrgDetailPayment[];
}

export interface AdminSubscriptionRow {
  id: string;
  organizationId: string;
  plan: OrgPlanTier;
  status: SubStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    suspended: boolean;
  };
}
