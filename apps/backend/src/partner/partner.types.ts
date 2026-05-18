import type { PlanTier } from '@prisma/client';

export interface CommissionReportRow {
  clientOrgId: string;
  clientName: string;
  plan: PlanTier;
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
