import type { AccountingMode, OrgProductLine } from '@/types/auth';

export type PartnerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

export type PartnerLinkRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Müşterinin gönderdiği partner bağlantı talebi */
export interface ClientPartnerLinkRequest {
  id: string;
  partnerOrgId: string;
  status: PartnerLinkRequestStatus;
  adminNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  partnerOrg: { id: string; name: string; slug: string };
}

/** Partnera gelen müşteri bağlantı talebi (admin onayı) */
export interface PartnerIncomingLinkRequest {
  id: string;
  clientOrgId: string;
  partnerOrgId: string;
  status: PartnerLinkRequestStatus;
  message: string | null;
  adminNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  clientOrg: { id: string; name: string; slug: string };
}

export interface ClientOnboardingRow {
  id: string;
  organizationId: string;
  clientOrgId: string | null;
  status: string;
  inviteEmail: string;
  inviteExpiresAt: string;
  completedAt: string | null;
  createdAt: string;
  inviteUrl: string;
  displayStatus: string;
  expired: boolean;
}

export interface PartnerListItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  activeClientCount: number;
  supportEmail: string | null;
  supportPhone: string | null;
  hasPendingRequest: boolean;
}

export interface PartnerRelationship {
  id: string;
  partnerOrgId: string;
  clientOrgId: string | null;
  invitedEmail?: string | null;
  status: PartnerStatus;
  commissionPct: string;
  canImpersonate: boolean;
  acceptedAt: string | null;
  createdAt: string;
  /** Son 30 gündeki sipariş sayısı (`GET /partner/clients`) */
  orders30d?: number;
  /** Bekleyen davetlerde kopyalanabilir bağlantı (API destekliyorsa) */
  inviteUrl?: string | null;
  clientOrg?: {
    id: string;
    name: string;
    slug: string;
    createdAt?: string;
    orgProducts?: OrgProductLine[];
    accountingMode?: AccountingMode;
  };
  partnerOrg?: {
    id: string;
    name: string;
    slug: string;
    whiteLabelSettings?: {
      brandName: string | null;
      supportEmail: string | null;
      supportPhone: string | null;
    } | null;
  };
}

export type PartnerPayoutRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PartnerPayoutRequest {
  id: string;
  partnerOrgId: string;
  partnerName?: string;
  amountTRY: number;
  status: PartnerPayoutRequestStatus;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface CommissionEntry {
  id: string;
  type: string;
  amount: string;
  description: string | null;
  status: string;
  createdAt: string;
  clientOrg?: { name: string };
}

export interface CommissionSummary {
  totalEarned: number;
  pendingAmount: number;
  settledAmount: number;
  activeClients: number;
  ledger: CommissionEntry[];
}

export interface PartnerDashboard {
  totalClients: number;
  activeClients30d: number;
  monthlyCommission: number;
  totalCommission: number;
  commissionPctSummary: { min: number; max: number; unique: number[] };
  commissionNote: string | null;
  recentActivities: Array<{
    happenedAt: string;
    title: string;
    detail: string | null;
  }>;
  clients: Array<{
    relationshipId: string;
    clientOrgId: string;
    name: string;
    slug: string;
    status: PartnerStatus;
    commissionPct: number;
    canImpersonate: boolean;
    connectionCount: number;
    orders30d: number;
    orgProducts: OrgProductLine[];
    accountingMode: AccountingMode;
  }>;
}

export interface PartnerCommissionsPage {
  items: CommissionEntry[];
  total: number;
  page: number;
  limit: number;
  currentMonthTotal: number;
}

export interface CommissionReportRow {
  clientOrgId: string;
  clientName: string;
  plan: string;
  monthlyFeeTRY: number;
  commissionPct: number;
  commissionAmountTRY: number;
}

export interface CommissionReport {
  year: number;
  month: number;
  rows: CommissionReportRow[];
  monthTotal: number;
  previousMonthTotal: number;
  lifetimePending: number;
  lifetimeSettled: number;
  trendLast6Months: Array<{ year: number; month: number; label: string; total: number }>;
}

export interface PartnerPerformance {
  totalActiveClients: number;
  newClientsThisMonth: number;
  avgCommissionPerClientTRY: number;
  topProfitableClients: Array<{
    clientOrgId: string;
    name: string;
    commissionThisMonthTRY: number;
  }>;
}

export interface WhiteLabelSettingsDto {
  id: string;
  organizationId: string;
  brandName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  customDomain: string | null;
  hideSenkronize: boolean;
  createdAt: string;
  updatedAt: string;
}
