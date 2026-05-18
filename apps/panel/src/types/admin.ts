import type { OrgPlanTier } from '@/types/auth';

export type SubStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface AdminPlatformStats {
  totalOrgs: number;
  activeSubscriptions: number;
  totalConnections: number;
  totalOrders: number;
  trialOrgs: number;
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
  };
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
