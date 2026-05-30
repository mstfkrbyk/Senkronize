import type {
  AccountingMode,
  CommissionLedger,
  PartnerStatus,
} from '@prisma/client';

import { ensureArray, ensureFiniteNumber } from '../common/ensure-array.util';
import type { resolveOrgProductLines } from '../common/product-lines';

import type { AdminPartnerRow } from './partner.types';

export type PartnerDashboardResponse = {
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
    orgProducts: ReturnType<typeof resolveOrgProductLines>;
    accountingMode: AccountingMode;
  }>;
};

export type PartnerCommissionsPageResponse<TItem = CommissionLedger> = {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
  currentMonthTotal: number;
};

export type PartnerCommissionSummaryResponse = {
  totalEarned: number;
  pendingAmount: number;
  settledAmount: number;
  activeClients: number;
  ledger: CommissionLedger[];
};

export function normalizeAdminPartnerRows(rows: AdminPartnerRow[]): AdminPartnerRow[] {
  return ensureArray(rows).map((p) => ({
    ...p,
    commissionRate: ensureFiniteNumber(p.commissionRate, 10),
    activeClientCount: Math.max(0, ensureFiniteNumber(p.activeClientCount, 0)),
  }));
}

export function normalizePartnerDashboardResponse(
  payload: PartnerDashboardResponse,
): PartnerDashboardResponse {
  const unique = ensureArray(payload.commissionPctSummary?.unique).map((v) =>
    ensureFiniteNumber(v, 0),
  );
  return {
    totalClients: Math.max(0, ensureFiniteNumber(payload.totalClients, 0)),
    activeClients30d: Math.max(
      0,
      ensureFiniteNumber(payload.activeClients30d, 0),
    ),
    monthlyCommission: ensureFiniteNumber(payload.monthlyCommission, 0),
    totalCommission: ensureFiniteNumber(payload.totalCommission, 0),
    commissionPctSummary: {
      min: ensureFiniteNumber(
        payload.commissionPctSummary?.min,
        unique.length ? Math.min(...unique) : 0,
      ),
      max: ensureFiniteNumber(
        payload.commissionPctSummary?.max,
        unique.length ? Math.max(...unique) : 0,
      ),
      unique,
    },
    commissionNote:
      typeof payload.commissionNote === 'string' ? payload.commissionNote : null,
    recentActivities: ensureArray(payload.recentActivities),
    clients: ensureArray(payload.clients).map((c) => ({
      ...c,
      commissionPct: ensureFiniteNumber(c.commissionPct, 10),
      connectionCount: Math.max(0, ensureFiniteNumber(c.connectionCount, 0)),
      orders30d: Math.max(0, ensureFiniteNumber(c.orders30d, 0)),
    })),
  };
}

export function normalizePartnerCommissionSummaryResponse(
  payload: PartnerCommissionSummaryResponse,
): PartnerCommissionSummaryResponse {
  const pendingAmount = ensureFiniteNumber(payload.pendingAmount, 0);
  const settledAmount = ensureFiniteNumber(payload.settledAmount, 0);
  return {
    totalEarned: ensureFiniteNumber(
      payload.totalEarned,
      pendingAmount + settledAmount,
    ),
    pendingAmount,
    settledAmount,
    activeClients: Math.max(0, ensureFiniteNumber(payload.activeClients, 0)),
    ledger: ensureArray(payload.ledger),
  };
}

export function normalizePartnerCommissionsPageResponse<TItem>(
  payload: PartnerCommissionsPageResponse<TItem>,
): PartnerCommissionsPageResponse<TItem> {
  const items = ensureArray(payload.items);
  return {
    items,
    total: Math.max(0, ensureFiniteNumber(payload.total, items.length)),
    page: Math.max(1, ensureFiniteNumber(payload.page, 1)),
    limit: Math.max(1, ensureFiniteNumber(payload.limit, 20)),
    currentMonthTotal: ensureFiniteNumber(payload.currentMonthTotal, 0),
  };
}
