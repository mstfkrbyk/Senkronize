import type { AccountingMode, OrgProductLine } from '@/types/auth';
import type { PartnerRelationship, PartnerStatus } from '@/types/partner';
import type { PlanTier } from '@/types/subscription';

export type ClientSortField = 'name' | 'orders30d';
export type ClientSortDir = 'asc' | 'desc';
export type ClientSort = `${ClientSortField}-${ClientSortDir}`;

export type StatusFilter = 'all' | PartnerStatus;
export type PlanFilter = 'all' | PlanTier;

export interface CommissionReportLookup {
  plan: string;
  monthlyRevenue: number;
  commissionAmount: number;
}

export interface PartnerClientTableRow {
  relationshipId: string;
  clientOrgId: string | null;
  name: string;
  slug: string;
  plan: string;
  orders30d: number;
  monthlyRevenue: number;
  commissionPct: number;
  commissionAmount: number;
  status: PartnerStatus;
  registeredAt: string;
  canImpersonate: boolean;
  orgProducts?: OrgProductLine[];
  accountingMode?: AccountingMode;
}

function parseFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return fallback;
}

function resolveDisplayName(
  rel: PartnerRelationship,
  invitePendingLabel: string,
): string {
  const orgName = rel.clientOrg?.name?.trim();
  if (orgName) {
    return orgName;
  }
  const email = rel.invitedEmail?.trim();
  if (email) {
    return email;
  }
  return invitePendingLabel;
}

function resolveDisplaySlug(rel: PartnerRelationship): string {
  const slug = rel.clientOrg?.slug?.trim();
  return slug && slug.length > 0 ? slug : '—';
}

function resolveOrders30d(rel: PartnerRelationship): number {
  if (typeof rel.orders30d === 'number' && Number.isFinite(rel.orders30d)) {
    return Math.max(0, rel.orders30d);
  }
  return 0;
}

/** Tablo / CSV satırları; `useMyClients` normalize çıktısı üzerine rapor birleşimi */
export function buildPartnerClientRows(
  relationships: PartnerRelationship[],
  reportByOrg: Map<string, CommissionReportLookup>,
  invitePendingLabel: string,
): PartnerClientTableRow[] {
  return relationships.map((rel) => {
    const cid = rel.clientOrgId;
    const report = cid ? reportByOrg.get(cid) : undefined;
    const commissionPct = parseFiniteNumber(rel.commissionPct, 10);
    const registeredAt =
      rel.clientOrg?.createdAt?.trim() || rel.createdAt?.trim() || '';

    return {
      relationshipId: rel.id,
      clientOrgId: cid,
      name: resolveDisplayName(rel, invitePendingLabel),
      slug: resolveDisplaySlug(rel),
      plan: report?.plan?.trim() || '—',
      orders30d: resolveOrders30d(rel),
      monthlyRevenue: parseFiniteNumber(report?.monthlyRevenue, 0),
      commissionPct,
      commissionAmount: parseFiniteNumber(report?.commissionAmount, 0),
      status: rel.status,
      registeredAt,
      canImpersonate:
        rel.canImpersonate === true &&
        rel.status === 'ACTIVE' &&
        typeof cid === 'string' &&
        cid.length > 0,
      orgProducts: rel.clientOrg?.orgProducts,
      accountingMode: rel.clientOrg?.accountingMode,
    };
  });
}

export function filterPartnerClientRows(
  rows: PartnerClientTableRow[],
  filters: {
    search: string;
    planFilter: PlanFilter;
    statusFilter: StatusFilter;
  },
): PartnerClientTableRow[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.statusFilter !== 'all' && row.status !== filters.statusFilter) {
      return false;
    }
    if (filters.planFilter !== 'all' && row.plan !== filters.planFilter) {
      return false;
    }
    if (
      q &&
      !row.name.toLowerCase().includes(q) &&
      !row.slug.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });
}

export function sortPartnerClientRows(
  rows: PartnerClientTableRow[],
  sort: ClientSort,
): PartnerClientTableRow[] {
  const sep = sort.lastIndexOf('-');
  const field = sort.slice(0, sep) as ClientSortField;
  const dir = sort.slice(sep + 1) as ClientSortDir;
  const mul = dir === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (field === 'orders30d') {
      return (a.orders30d - b.orders30d) * mul;
    }
    return a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }) * mul;
  });
}
