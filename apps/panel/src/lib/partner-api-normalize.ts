import { asArray } from '@/lib/admin-api-normalize';
import type { AccountingMode, OrgProductLine } from '@/types/auth';
import type { PartnerLinkStatus } from '@/types/admin';
import type {
  ClientOnboardingRow,
  ClientPartnerLinkRequest,
  CommissionEntry,
  CommissionReport,
  CommissionReportRow,
  CommissionSummary,
  PartnerCommissionsPage,
  PartnerDashboard,
  PartnerIncomingLinkRequest,
  PartnerLinkRequestStatus,
  PartnerListItem,
  PartnerPayoutRequest,
  PartnerPayoutRequestStatus,
  PartnerPerformance,
  PartnerRelationship,
  PartnerStatus,
} from '@/types/partner';

const DEFAULT_ORG_PRODUCT_LINES: OrgProductLine[] = ['INTEGRATION', 'ACCOUNTING'];

const PARTNER_STATUSES = new Set<PartnerStatus>([
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'TERMINATED',
]);

const PAYOUT_STATUSES = new Set<PartnerPayoutRequestStatus>([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

function normalizePayoutStatus(value: unknown): PartnerPayoutRequestStatus {
  return typeof value === 'string' &&
    PAYOUT_STATUSES.has(value as PartnerPayoutRequestStatus)
    ? (value as PartnerPayoutRequestStatus)
    : 'PENDING';
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

function normalizeOrgProducts(raw: unknown): OrgProductLine[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_ORG_PRODUCT_LINES];
  }
  return raw.filter(
    (line): line is OrgProductLine =>
      line === 'INTEGRATION' || line === 'ACCOUNTING',
  );
}

function resolveAccountingMode(mode: unknown): AccountingMode {
  return mode === 'NATIVE' || mode === 'EXTERNAL_ERP' ? mode : 'NATIVE';
}

function normalizePartnerStatus(value: unknown): PartnerStatus {
  return typeof value === 'string' &&
    PARTNER_STATUSES.has(value as PartnerStatus)
    ? (value as PartnerStatus)
    : 'PENDING';
}

function formatCommissionPct(value: unknown): string {
  return String(parseFiniteNumber(value, 10));
}

function normalizeOrgRef(
  raw: unknown,
): { id: string; name: string; slug: string } | undefined {
  if (raw === null || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  if (!id) {
    return undefined;
  }
  return {
    id,
    name:
      typeof o.name === 'string' && o.name.trim().length > 0
        ? o.name.trim()
        : 'Adsız organizasyon',
    slug:
      typeof o.slug === 'string' && o.slug.trim().length > 0
        ? o.slug.trim()
        : '—',
  };
}

function normalizeClientOrgRef(
  raw: unknown,
): PartnerRelationship['clientOrg'] | undefined {
  if (raw === null || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const base = normalizeOrgRef(raw);
  if (!base) {
    return undefined;
  }
  return {
    ...base,
    createdAt:
      typeof o.createdAt === 'string' && o.createdAt.trim().length > 0
        ? o.createdAt
        : undefined,
    orgProducts: normalizeOrgProducts(o.orgProducts ?? o.productLines),
    accountingMode: resolveAccountingMode(o.accountingMode),
  };
}

function normalizePartnerOrgRef(
  raw: unknown,
): PartnerRelationship['partnerOrg'] | undefined {
  if (raw === null || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const base = normalizeOrgRef(raw);
  if (!base) {
    return undefined;
  }
  const wl = o.whiteLabelSettings;
  let whiteLabelSettings: NonNullable<
    PartnerRelationship['partnerOrg']
  >['whiteLabelSettings'] = null;
  if (wl !== null && typeof wl === 'object') {
    const w = wl as Record<string, unknown>;
    whiteLabelSettings = {
      brandName: typeof w.brandName === 'string' ? w.brandName : null,
      supportEmail: typeof w.supportEmail === 'string' ? w.supportEmail : null,
      supportPhone: typeof w.supportPhone === 'string' ? w.supportPhone : null,
    };
  }
  return { ...base, whiteLabelSettings };
}

/** Tek ilişki satırı; geçersiz id için null */
export function normalizePartnerRelationship(
  raw: unknown,
): PartnerRelationship | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  if (!id) {
    return null;
  }

  const partnerOrgId =
    typeof r.partnerOrgId === 'string' && r.partnerOrgId.trim().length > 0
      ? r.partnerOrgId.trim()
      : '';
  if (!partnerOrgId) {
    return null;
  }

  const clientOrgId =
    typeof r.clientOrgId === 'string' && r.clientOrgId.trim().length > 0
      ? r.clientOrgId.trim()
      : null;

  const createdAt =
    typeof r.createdAt === 'string' && r.createdAt.trim().length > 0
      ? r.createdAt
      : new Date(0).toISOString();

  return {
    id,
    partnerOrgId,
    clientOrgId,
    invitedEmail:
      typeof r.invitedEmail === 'string' ? r.invitedEmail : null,
    status: normalizePartnerStatus(r.status),
    commissionPct: formatCommissionPct(r.commissionPct),
    canImpersonate: r.canImpersonate === true,
    acceptedAt: typeof r.acceptedAt === 'string' ? r.acceptedAt : null,
    createdAt,
    orders30d:
      typeof r.orders30d === 'number' && Number.isFinite(r.orders30d)
        ? Math.max(0, r.orders30d)
        : undefined,
    inviteUrl: typeof r.inviteUrl === 'string' ? r.inviteUrl : null,
    clientOrg: normalizeClientOrgRef(r.clientOrg),
    partnerOrg: normalizePartnerOrgRef(r.partnerOrg),
  };
}

export function normalizePartnerRelationships(
  data: unknown,
): PartnerRelationship[] {
  return asArray(data)
    .map((row) => normalizePartnerRelationship(row))
    .filter((row): row is PartnerRelationship => row !== null);
}

function normalizeCommissionPctSummary(
  raw: unknown,
): PartnerDashboard['commissionPctSummary'] {
  const r =
    raw !== null && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : {};
  const unique = asArray<unknown>(r.unique)
    .map((v) => parseFiniteNumber(v, NaN))
    .filter((n) => Number.isFinite(n));
  return {
    min: parseFiniteNumber(r.min, unique.length ? Math.min(...unique) : 0),
    max: parseFiniteNumber(r.max, unique.length ? Math.max(...unique) : 0),
    unique,
  };
}

function normalizeDashboardClient(
  raw: unknown,
): PartnerDashboard['clients'][number] | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const clientOrgId =
    typeof r.clientOrgId === 'string' ? r.clientOrgId.trim() : '';
  const relationshipId =
    typeof r.relationshipId === 'string' ? r.relationshipId.trim() : '';
  if (!clientOrgId || !relationshipId) {
    return null;
  }
  return {
    relationshipId,
    clientOrgId,
    name:
      typeof r.name === 'string' && r.name.trim().length > 0
        ? r.name.trim()
        : 'Adsız müşteri',
    slug:
      typeof r.slug === 'string' && r.slug.trim().length > 0
        ? r.slug.trim()
        : '—',
    status: normalizePartnerStatus(r.status),
    commissionPct: parseFiniteNumber(r.commissionPct, 10),
    canImpersonate: r.canImpersonate === true,
    connectionCount: Math.max(0, parseFiniteNumber(r.connectionCount, 0)),
    orders30d: Math.max(0, parseFiniteNumber(r.orders30d, 0)),
    orgProducts: normalizeOrgProducts(r.orgProducts ?? r.productLines),
    accountingMode: resolveAccountingMode(r.accountingMode),
  };
}

function normalizeDashboardActivity(
  raw: unknown,
): PartnerDashboard['recentActivities'][number] | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const happenedAt =
    typeof r.happenedAt === 'string' && r.happenedAt.trim().length > 0
      ? r.happenedAt
      : '';
  const title =
    typeof r.title === 'string' && r.title.trim().length > 0
      ? r.title.trim()
      : '';
  if (!happenedAt || !title) {
    return null;
  }
  return {
    happenedAt,
    title,
    detail: typeof r.detail === 'string' ? r.detail : null,
  };
}

export function normalizePartnerDashboard(
  data: Partial<PartnerDashboard> | null | undefined,
): PartnerDashboard {
  const d = data ?? {};
  const clients = asArray(d.clients)
    .map((row) => normalizeDashboardClient(row))
    .filter((row): row is PartnerDashboard['clients'][number] => row !== null);
  const recentActivities = asArray(d.recentActivities)
    .map((row) => normalizeDashboardActivity(row))
    .filter(
      (row): row is PartnerDashboard['recentActivities'][number] => row !== null,
    );

  return {
    totalClients: parseFiniteNumber(d.totalClients, clients.length),
    activeClients30d: parseFiniteNumber(d.activeClients30d, 0),
    monthlyCommission: parseFiniteNumber(d.monthlyCommission, 0),
    totalCommission: parseFiniteNumber(d.totalCommission, 0),
    commissionPctSummary: normalizeCommissionPctSummary(d.commissionPctSummary),
    commissionNote:
      typeof d.commissionNote === 'string' ? d.commissionNote : null,
    recentActivities,
    clients,
  };
}

export function normalizeCommissionEntry(raw: unknown): CommissionEntry | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  if (!id) {
    return null;
  }
  const createdAt =
    typeof r.createdAt === 'string' && r.createdAt.trim().length > 0
      ? r.createdAt
      : new Date(0).toISOString();
  const clientOrg =
    r.clientOrg !== null && typeof r.clientOrg === 'object'
      ? {
          name:
            typeof (r.clientOrg as Record<string, unknown>).name === 'string'
              ? String((r.clientOrg as Record<string, unknown>).name)
              : '—',
        }
      : undefined;

  return {
    id,
    type: typeof r.type === 'string' ? r.type : 'UNKNOWN',
    amount:
      typeof r.amount === 'string'
        ? r.amount
        : String(parseFiniteNumber(r.amount, 0)),
    description: typeof r.description === 'string' ? r.description : null,
    status: typeof r.status === 'string' ? r.status : 'PENDING',
    createdAt,
    clientOrg,
  };
}

export function normalizeCommissionSummary(
  data: Partial<CommissionSummary> | null | undefined,
): CommissionSummary {
  const d = data ?? {};
  const ledger = asArray(d.ledger)
    .map((row) => normalizeCommissionEntry(row))
    .filter((row): row is CommissionEntry => row !== null);

  return {
    totalEarned: parseFiniteNumber(d.totalEarned, 0),
    pendingAmount: parseFiniteNumber(d.pendingAmount, 0),
    settledAmount: parseFiniteNumber(d.settledAmount, 0),
    activeClients: Math.max(0, parseFiniteNumber(d.activeClients, 0)),
    ledger,
  };
}

export function normalizePartnerCommissionsPage(
  data: Partial<PartnerCommissionsPage> | null | undefined,
): PartnerCommissionsPage {
  const d = data ?? {};
  const items = asArray(d.items)
    .map((row) => normalizeCommissionEntry(row))
    .filter((row): row is CommissionEntry => row !== null);

  return {
    items,
    total: typeof d.total === 'number' && Number.isFinite(d.total) ? d.total : items.length,
    page: typeof d.page === 'number' && Number.isFinite(d.page) ? Math.max(1, d.page) : 1,
    limit:
      typeof d.limit === 'number' && Number.isFinite(d.limit)
        ? Math.max(1, d.limit)
        : items.length || 20,
    currentMonthTotal: parseFiniteNumber(d.currentMonthTotal, 0),
  };
}

function normalizeCommissionReportRow(raw: unknown): CommissionReportRow | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const clientOrgId =
    typeof r.clientOrgId === 'string' ? r.clientOrgId.trim() : '';
  if (!clientOrgId) {
    return null;
  }
  return {
    clientOrgId,
    clientName:
      typeof r.clientName === 'string' && r.clientName.trim().length > 0
        ? r.clientName.trim()
        : '—',
    plan: typeof r.plan === 'string' ? r.plan : '—',
    monthlyFeeTRY: parseFiniteNumber(r.monthlyFeeTRY, 0),
    commissionPct: parseFiniteNumber(r.commissionPct, 10),
    commissionAmountTRY: parseFiniteNumber(r.commissionAmountTRY, 0),
  };
}

function normalizeTrendMonth(
  raw: unknown,
): CommissionReport['trendLast6Months'][number] | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const year = parseFiniteNumber(r.year, NaN);
  const month = parseFiniteNumber(r.month, NaN);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  return {
    year,
    month,
    label: typeof r.label === 'string' ? r.label : `${month}/${year}`,
    total: parseFiniteNumber(r.total, 0),
  };
}

export function normalizeCommissionReport(
  data: Partial<CommissionReport> | null | undefined,
): CommissionReport {
  const d = data ?? {};
  const rows = asArray(d.rows)
    .map((row) => normalizeCommissionReportRow(row))
    .filter((row): row is CommissionReportRow => row !== null);
  const trendLast6Months = asArray(d.trendLast6Months)
    .map((row) => normalizeTrendMonth(row))
    .filter(
      (row): row is CommissionReport['trendLast6Months'][number] => row !== null,
    );

  const year = parseFiniteNumber(d.year, new Date().getFullYear());
  const month = Math.min(
    12,
    Math.max(1, parseFiniteNumber(d.month, new Date().getMonth() + 1)),
  );

  return {
    year,
    month,
    rows,
    monthTotal: parseFiniteNumber(d.monthTotal, 0),
    previousMonthTotal: parseFiniteNumber(d.previousMonthTotal, 0),
    lifetimePending: parseFiniteNumber(d.lifetimePending, 0),
    lifetimeSettled: parseFiniteNumber(d.lifetimeSettled, 0),
    trendLast6Months,
  };
}

function normalizeTopProfitableClient(
  raw: unknown,
): PartnerPerformance['topProfitableClients'][number] | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const clientOrgId =
    typeof r.clientOrgId === 'string' ? r.clientOrgId.trim() : '';
  if (!clientOrgId) {
    return null;
  }
  return {
    clientOrgId,
    name:
      typeof r.name === 'string' && r.name.trim().length > 0
        ? r.name.trim()
        : '—',
    commissionThisMonthTRY: parseFiniteNumber(
      r.commissionThisMonthTRY,
      0,
    ),
  };
}

export function normalizePartnerPerformance(
  data: Partial<PartnerPerformance> | null | undefined,
): PartnerPerformance {
  const d = data ?? {};
  const topProfitableClients = asArray(d.topProfitableClients)
    .map((row) => normalizeTopProfitableClient(row))
    .filter(
      (row): row is PartnerPerformance['topProfitableClients'][number] =>
        row !== null,
    );

  return {
    totalActiveClients: Math.max(0, parseFiniteNumber(d.totalActiveClients, 0)),
    newClientsThisMonth: Math.max(0, parseFiniteNumber(d.newClientsThisMonth, 0)),
    avgCommissionPerClientTRY: parseFiniteNumber(
      d.avgCommissionPerClientTRY,
      0,
    ),
    topProfitableClients,
  };
}

/** Tek onboarding daveti; geçersiz id için null */
export function normalizeClientOnboardingRow(
  raw: unknown,
): ClientOnboardingRow | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  if (!id) {
    return null;
  }

  const organizationId =
    typeof r.organizationId === 'string' && r.organizationId.trim().length > 0
      ? r.organizationId.trim()
      : '';
  const inviteEmail =
    typeof r.inviteEmail === 'string' && r.inviteEmail.trim().length > 0
      ? r.inviteEmail.trim()
      : '—';
  const createdAt =
    typeof r.createdAt === 'string' && r.createdAt.trim().length > 0
      ? r.createdAt
      : new Date(0).toISOString();
  const inviteExpiresAt =
    typeof r.inviteExpiresAt === 'string' && r.inviteExpiresAt.trim().length > 0
      ? r.inviteExpiresAt
      : createdAt;

  return {
    id,
    organizationId,
    clientOrgId:
      typeof r.clientOrgId === 'string' && r.clientOrgId.trim().length > 0
        ? r.clientOrgId.trim()
        : null,
    status: typeof r.status === 'string' ? r.status : 'INVITED',
    inviteEmail,
    inviteExpiresAt,
    completedAt: typeof r.completedAt === 'string' ? r.completedAt : null,
    createdAt,
    inviteUrl: typeof r.inviteUrl === 'string' ? r.inviteUrl : '',
    displayStatus:
      typeof r.displayStatus === 'string' ? r.displayStatus : 'INVITED',
    expired: r.expired === true,
  };
}

export function normalizeClientOnboardingInvites(
  data: unknown,
): ClientOnboardingRow[] {
  return asArray(data)
    .map((row) => normalizeClientOnboardingRow(row))
    .filter((row): row is ClientOnboardingRow => row !== null);
}

/** Müşteri tarafı partner keşif listesi */
export function normalizePartnerListItem(raw: unknown): PartnerListItem | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  if (!id) {
    return null;
  }
  return {
    id,
    name:
      typeof r.name === 'string' && r.name.trim().length > 0
        ? r.name.trim()
        : 'Adsız partner',
    slug:
      typeof r.slug === 'string' && r.slug.trim().length > 0
        ? r.slug.trim()
        : '—',
    description: typeof r.description === 'string' ? r.description : '',
    activeClientCount: Math.max(0, parseFiniteNumber(r.activeClientCount, 0)),
    supportEmail: typeof r.supportEmail === 'string' ? r.supportEmail : null,
    supportPhone: typeof r.supportPhone === 'string' ? r.supportPhone : null,
    hasPendingRequest: r.hasPendingRequest === true,
  };
}

export function normalizePartnerListItems(data: unknown): PartnerListItem[] {
  return asArray(data)
    .map((row) => normalizePartnerListItem(row))
    .filter((row): row is PartnerListItem => row !== null);
}

export function normalizePartnerPayoutRequest(
  raw: unknown,
): PartnerPayoutRequest | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  const partnerOrgId =
    typeof r.partnerOrgId === 'string' ? r.partnerOrgId.trim() : '';
  if (!id || !partnerOrgId) {
    return null;
  }
  const createdAt =
    typeof r.createdAt === 'string' && r.createdAt.trim().length > 0
      ? r.createdAt
      : new Date(0).toISOString();
  return {
    id,
    partnerOrgId,
    partnerName:
      typeof r.partnerName === 'string' && r.partnerName.trim().length > 0
        ? r.partnerName.trim()
        : undefined,
    amountTRY: parseFiniteNumber(r.amountTRY, 0),
    status: normalizePayoutStatus(r.status),
    createdAt,
    reviewedAt:
      typeof r.reviewedAt === 'string' && r.reviewedAt.trim().length > 0
        ? r.reviewedAt
        : null,
  };
}

export function normalizePartnerPayoutRequests(
  data: unknown,
): PartnerPayoutRequest[] {
  return asArray(data)
    .map((row) => normalizePartnerPayoutRequest(row))
    .filter((row): row is PartnerPayoutRequest => row !== null);
}

const PARTNER_LINK_STATUSES = new Set<PartnerLinkRequestStatus>([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

function normalizePartnerLinkRequestStatus(value: unknown): PartnerLinkRequestStatus {
  return typeof value === 'string' &&
    PARTNER_LINK_STATUSES.has(value as PartnerLinkStatus)
    ? (value as PartnerLinkRequestStatus)
    : 'PENDING';
}

export function normalizeClientPartnerLinkRequest(
  raw: unknown,
): ClientPartnerLinkRequest | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  const partnerOrgId =
    typeof r.partnerOrgId === 'string' ? r.partnerOrgId.trim() : '';
  const partnerOrg = normalizeOrgRef(r.partnerOrg);
  if (!id || !partnerOrgId || !partnerOrg) {
    return null;
  }
  return {
    id,
    partnerOrgId,
    status: normalizePartnerLinkRequestStatus(r.status),
    adminNote: typeof r.adminNote === 'string' ? r.adminNote : null,
    requestedAt:
      typeof r.requestedAt === 'string' && r.requestedAt.trim().length > 0
        ? r.requestedAt
        : new Date(0).toISOString(),
    reviewedAt: typeof r.reviewedAt === 'string' ? r.reviewedAt : null,
    partnerOrg,
  };
}

export function normalizeClientPartnerLinkRequests(
  data: unknown,
): ClientPartnerLinkRequest[] {
  return asArray(data)
    .map((row) => normalizeClientPartnerLinkRequest(row))
    .filter((row): row is ClientPartnerLinkRequest => row !== null);
}

export function normalizePartnerIncomingLinkRequest(
  raw: unknown,
): PartnerIncomingLinkRequest | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  const clientOrgId =
    typeof r.clientOrgId === 'string' ? r.clientOrgId.trim() : '';
  const partnerOrgId =
    typeof r.partnerOrgId === 'string' ? r.partnerOrgId.trim() : '';
  const clientOrg = normalizeOrgRef(r.clientOrg);
  if (!id || !clientOrgId || !partnerOrgId || !clientOrg) {
    return null;
  }
  return {
    id,
    clientOrgId,
    partnerOrgId,
    status: normalizePartnerLinkRequestStatus(r.status),
    message: typeof r.message === 'string' ? r.message : null,
    adminNote: typeof r.adminNote === 'string' ? r.adminNote : null,
    requestedAt:
      typeof r.requestedAt === 'string' && r.requestedAt.trim().length > 0
        ? r.requestedAt
        : new Date(0).toISOString(),
    reviewedAt: typeof r.reviewedAt === 'string' ? r.reviewedAt : null,
    clientOrg,
  };
}

export function normalizePartnerIncomingLinkRequests(
  data: unknown,
): PartnerIncomingLinkRequest[] {
  return asArray(data)
    .map((row) => normalizePartnerIncomingLinkRequest(row))
    .filter((row): row is PartnerIncomingLinkRequest => row !== null);
}
