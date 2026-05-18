import type { Marketplace, PlanTier, SubStatus } from '@prisma/client';

export interface DailySignupPoint {
  date: string;
  count: number;
}

export interface PlanCountEntry {
  plan: PlanTier;
  count: number;
}

export interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  inactiveOrganizations: number;
  totalUsers: number;
  planDistribution: PlanCountEntry[];
  trialActiveOrganizations: number;
  newRegistrationsLast30Days: number;
  ordersThisMonthCount: number;
  activeMarketplaceConnections: number;
  /** 0–100, tahmini genel sağlık skoru */
  platformHealthScore: number;
  /** Son 30 gün, UTC gün bazlı yeni organizasyon sayıları */
  dailyNewRegistrations: DailySignupPoint[];
}

export interface RevenuePlanShare {
  plan: PlanTier;
  monthlyRevenueKurus: number;
  organizationCount: number;
}

export interface RevenueMonthPoint {
  monthKey: string;
  revenueKurus: number;
}

export interface RevenueStats {
  mrrKurus: number;
  projectedArrKurus: number;
  planRevenueDistribution: RevenuePlanShare[];
  last12MonthsRevenue: RevenueMonthPoint[];
}

export interface AdminOrgListItem {
  id: string;
  name: string;
  slug: string;
  taxNumber: string | null;
  suspended: boolean;
  createdAt: Date;
  subscription: {
    plan: PlanTier;
    status: SubStatus;
    trialEndsAt: Date | null;
  } | null;
  _count: {
    users: number;
    marketplaceConnections: number;
    orders: number;
  };
  lastActivityAt: string | null;
}

export interface PaginatedOrganizations {
  orgs: AdminOrgListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface OrgDetailUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface OrgDetailConnection {
  id: string;
  platform: Marketplace;
  isActive: boolean;
  lastSyncAt: Date | null;
  syncErrorCount: number;
  lastErrorAt: Date | null;
}

export interface OrgDetailOrder {
  id: string;
  platform: Marketplace;
  platformOrderId: string;
  status: string;
  customerName: string;
  totalAmount: string;
  currency: string;
  createdAt: Date;
}

export interface OrgDetailAuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorUserId: string;
  actorOrgId: string;
  impersonatedOrgId: string | null;
  createdAt: Date;
}

export interface OrgDetailPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  plan: PlanTier;
  createdAt: Date;
}

export interface OrganizationDetail {
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
    createdAt: Date;
  };
  subscription: {
    plan: PlanTier;
    status: SubStatus;
    trialEndsAt: Date | null;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    nextBillingAt: Date | null;
  } | null;
  users: OrgDetailUser[];
  marketplaceConnections: OrgDetailConnection[];
  recentOrders: OrgDetailOrder[];
  recentAuditLogs: OrgDetailAuditEntry[];
  payments: OrgDetailPayment[];
}

export interface ActivityItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorUserId: string;
  actorOrgId: string;
  impersonatedOrgId: string | null;
  createdAt: Date;
}

export interface PlatformHealthRow {
  platform: Marketplace;
  activeConnections: number;
  errorRate24h: number;
  averageSyncDurationMs: number | null;
  lastSyncAt: Date | null;
}

export interface HealthStats {
  platforms: PlatformHealthRow[];
}
