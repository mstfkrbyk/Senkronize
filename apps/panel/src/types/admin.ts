import type { AccountingMode, OrgPlanTier, OrgProductLine } from '@/types/auth';

export type SubStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELING'
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

export type AdminProductLineBucket = 'INTEGRATION' | 'ACCOUNTING' | 'BUNDLE';

export interface ProductLineCountEntry {
  bucket: AdminProductLineBucket;
  count: number;
}

export interface AccountingModeCountEntry {
  mode: AccountingMode;
  count: number;
}

export interface AdminPlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  inactiveOrganizations: number;
  totalUsers: number;
  planDistribution: PlanCountEntry[];
  productLineDistribution: ProductLineCountEntry[];
  accountingModeDistribution: AccountingModeCountEntry[];
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

export interface AdminOrgListPartner {
  id: string;
  name: string;
  slug: string;
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
  orgProducts: OrgProductLine[];
  accountingMode: AccountingMode;
  activePartners: AdminOrgListPartner[];
}

export interface AdminActivityItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorUserId: string;
  actorOrgId: string;
  actorOrgName?: string | null;
  impersonatedOrgId: string | null;
  impersonatedOrgName?: string | null;
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

export interface AdminBlockedIpsResponse {
  ips: string[];
}

export interface AdminPlatformDailyRequestPoint {
  platform: string;
  date: string;
  requestCount: number;
}

export interface AdminRateLimitStats {
  violationsToday: number;
  platformDailyRequests: AdminPlatformDailyRequestPoint[];
  topViolatingPlatforms: Array<{ platform: string; count: number }>;
}

export type AdminPlatformCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface AdminPlatformCircuitHealth {
  platform: string;
  state: AdminPlatformCircuitState;
  consecutiveFailures: number;
  halfOpenSuccesses: number;
  errorCountInWindow: number;
  openedAt: string | null;
  nextProbeAt: string | null;
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

export interface AdminOrgDetailPartnerLink {
  relationshipId: string;
  partnerOrgId: string;
  name: string;
  slug: string;
  commissionPct: number;
  canImpersonate: boolean;
  acceptedAt: string | null;
}

export type AdminProductSelection = 'INTEGRATION' | 'ACCOUNTING' | 'BUNDLE';

export interface AdminUpdateSubscriptionPayload {
  status?: SubStatus;
  trialEndsAt?: string;
  reason: string;
}

export interface AdminChangeAccountingModePayload {
  accountingMode: AccountingMode;
  reason: string;
}

export interface AdminOrgDetailErpConnection {
  id: string;
  erpType: string;
  displayName: string | null;
  role: 'PRIMARY' | 'SECONDARY';
  isActive: boolean;
  lastSyncAt: string | null;
  syncErrorCount: number;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
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
  erpConnections?: AdminOrgDetailErpConnection[];
  erpSlotLimit?: number | null;
  extraErpSlotCount?: number;
  recentOrders: AdminOrgDetailOrder[];
  recentAuditLogs: AdminOrgDetailAuditEntry[];
  payments: AdminOrgDetailPayment[];
  orgProducts: OrgProductLine[];
  accountingMode: AccountingMode | null;
  activeErpConnectionCount: number;
  activePartners: AdminOrgDetailPartnerLink[];
  internalAccount?: boolean;
  billingExempt?: boolean;
}

export interface ConfigureInternalAccountPayload {
  enabled: boolean;
  plan?: OrgPlanTier;
  reason: string;
}

export interface AdminPartnerRow {
  id: string;
  name: string;
  slug: string;
  commissionRate: number;
  activeClientCount: number;
  createdAt: string;
  isDemo: boolean;
}

export type AdminPartnerPayoutStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminPartnerPayoutRequest {
  id: string;
  partnerOrgId: string;
  partnerName?: string;
  amountTRY: number;
  status: AdminPartnerPayoutStatus;
  createdAt: string;
  reviewedAt?: string | null;
}

export type PartnerLinkStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminPartnerLinkRequest {
  id: string;
  clientOrgId: string;
  partnerOrgId: string;
  status: PartnerLinkStatus;
  message: string | null;
  adminNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  clientOrg: { id: string; name: string; slug: string };
  partnerOrg: { id: string; name: string; slug: string };
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  suspended: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string } | null;
}

export interface AdminUsersListResponse {
  users: AdminUserRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  suspended: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    suspended: boolean;
  } | null;
}

export interface AdminUserDetailAuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
}

export interface AdminUserAuditLogResponse {
  logs: AdminUserDetailAuditEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminActivitySummary {
  syncCount: number;
  orderCount: number;
  errorCount: number;
}

export interface AdminOrgNote {
  id: string;
  orgId: string;
  adminId: string;
  content: string;
  createdAt: string;
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
    orgProducts: OrgProductLine[];
    accountingMode: AccountingMode;
  };
}

export interface AdminIntegrationHealth {
  platform: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  consecutiveFailures: number;
  halfOpenSuccesses: number;
  errorCountInWindow: number;
  openedAt: string | null;
  nextProbeAt: string | null;
  healthScore: number;
}

export interface AdminIntegrationPolicyField {
  key: string;
  label: string;
  description?: string;
  type: 'number' | 'hour' | 'syncFrequency' | 'boolean';
  min?: number;
  max?: number;
  section: 'sync' | 'rateLimit' | 'general';
}

export interface AdminIntegrationPolicyValues {
  enabled: boolean;
  orderSyncIntervalMinutes: number | null;
  orderLookbackMinutes: number | null;
  listingSyncIntervalMinutes: number | null;
  listingSyncHour: number | null;
  maxRequestsPerHour: number | null;
  requestsPerMinute: number | null;
  syncFrequency:
    | 'MANUAL'
    | 'REALTIME'
    | 'EVERY_15_MIN'
    | 'HOURLY'
    | 'EVERY_4_HOURS'
    | 'DAILY'
    | null;
}

export interface AdminIntegrationListItem {
  platformKey: string;
  displayName: string;
  category: 'MARKETPLACE' | 'ECOMMERCE' | 'ERP';
  categoryLabel: string;
  enabled: boolean;
  health: AdminIntegrationHealth;
  effectiveRpm: number;
  requestsToday: number;
  hasCustomPolicy: boolean;
  updatedAt: string | null;
}

export interface AdminIntegrationDetail {
  platformKey: string;
  displayName: string;
  category: 'MARKETPLACE' | 'ECOMMERCE' | 'ERP';
  categoryLabel: string;
  schema: {
    platformKey: string;
    category: 'MARKETPLACE' | 'ECOMMERCE' | 'ERP';
    displayName: string;
    fields: AdminIntegrationPolicyField[];
  };
  fields: AdminIntegrationPolicyField[];
  values: AdminIntegrationPolicyValues;
  effective: AdminIntegrationPolicyValues;
  health: AdminIntegrationHealth;
  requestsToday: number;
  violationsToday: number;
  updatedAt: string | null;
  updatedByUserId: string | null;
}

export type PlatformActivityLevel = 'INFO' | 'WARN' | 'ERROR';

export interface PlatformActivityEntry {
  id: string;
  at: string;
  platform: string;
  organizationId: string | null;
  level: PlatformActivityLevel;
  action: string;
  message: string;
  metadata?: Record<string, unknown>;
}
