export type PartnerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

export interface PartnerRelationship {
  id: string;
  partnerOrgId: string;
  clientOrgId: string;
  status: PartnerStatus;
  commissionPct: string;
  canImpersonate: boolean;
  acceptedAt: string | null;
  createdAt: string;
  /** Bekleyen davetlerde kopyalanabilir bağlantı (API destekliyorsa) */
  inviteUrl?: string | null;
  clientOrg?: { id: string; name: string; slug: string };
  partnerOrg?: { id: string; name: string; slug: string };
}

export interface CommissionSummary {
  totalEarned: number;
  pendingAmount: number;
  settledAmount: number;
  activeClients: number;
  ledger: CommissionEntry[];
}

export interface CommissionEntry {
  id: string;
  type: string;
  amount: string;
  description: string | null;
  status: string;
  createdAt: string;
}
