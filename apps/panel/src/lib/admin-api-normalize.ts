import { isDemoPartnerSlug } from '@/lib/admin-partner-nav';
import { normalizeAdminOrganizationRow } from '@/lib/admin-org-list-normalize';
import type {
  AdminActivityItem,
  AdminCohortData,
  AdminHealthStats,
  AdminPlatformHealthRow,
  AdminOrgDetailAuditEntry,
  AdminOrgDetailConnection,
  AdminOrgDetailErpConnection,
  AdminOrgDetailOrder,
  AdminOrgDetailUser,
  AdminOrgNote,
  AdminOrganizationDetailResponse,
  AdminOrganizationRow,
  AdminOrgListResponse,
  AdminPartnerLinkRequest,
  AdminPartnerPayoutRequest,
  AdminPartnerPayoutStatus,
  AdminPartnerRow,
  AdminPlatformStats,
  AdminUsersListResponse,
  PartnerLinkStatus,
} from '@/types/admin';

/** API yanıtında eksik/null dizi alanlarını güvenli diziye çevirir */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeAdminOrgListResponse(
  data: Partial<AdminOrgListResponse> | null | undefined,
): AdminOrgListResponse {
  const orgs = asArray<AdminOrganizationRow>(data?.orgs).map((org) =>
    normalizeAdminOrganizationRow(org),
  );
  return {
    orgs,
    total: typeof data?.total === 'number' ? data.total : orgs.length,
    page: typeof data?.page === 'number' ? data.page : 1,
    limit: typeof data?.limit === 'number' ? data.limit : orgs.length,
  };
}

export function normalizeAdminUsersListResponse(
  data: Partial<AdminUsersListResponse> | null | undefined,
): AdminUsersListResponse {
  const users = asArray<AdminUsersListResponse['users'][number]>(data?.users);
  return {
    users,
    total: typeof data?.total === 'number' ? data.total : users.length,
    page: typeof data?.page === 'number' ? data.page : 1,
    limit: typeof data?.limit === 'number' ? data.limit : users.length,
  };
}

function normalizeOrgDetailUser(raw: unknown): AdminOrgDetailUser | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  if (!id) {
    return null;
  }
  return {
    id,
    email: typeof r.email === 'string' ? r.email : '—',
    name: typeof r.name === 'string' && r.name.trim().length > 0 ? r.name : '—',
    role: typeof r.role === 'string' ? r.role : '—',
    lastLoginAt: typeof r.lastLoginAt === 'string' ? r.lastLoginAt : null,
    createdAt:
      typeof r.createdAt === 'string' ? r.createdAt : new Date(0).toISOString(),
  };
}

function normalizeOrgDetailConnection(
  raw: unknown,
): AdminOrgDetailConnection | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  if (!id) {
    return null;
  }
  return {
    id,
    platform: typeof r.platform === 'string' ? r.platform : '—',
    isActive: r.isActive === true,
    lastSyncAt: typeof r.lastSyncAt === 'string' ? r.lastSyncAt : null,
    syncErrorCount:
      typeof r.syncErrorCount === 'number' && Number.isFinite(r.syncErrorCount)
        ? Math.max(0, r.syncErrorCount)
        : 0,
    lastErrorAt: typeof r.lastErrorAt === 'string' ? r.lastErrorAt : null,
  };
}

function normalizeOrgDetailErpConnection(
  raw: unknown,
): AdminOrgDetailErpConnection | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  if (!id) {
    return null;
  }
  const role = r.role === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY';
  return {
    id,
    erpType: typeof r.erpType === 'string' ? r.erpType : '—',
    displayName: typeof r.displayName === 'string' ? r.displayName : null,
    role,
    isActive: r.isActive === true,
    lastSyncAt: typeof r.lastSyncAt === 'string' ? r.lastSyncAt : null,
    syncErrorCount:
      typeof r.syncErrorCount === 'number' && Number.isFinite(r.syncErrorCount)
        ? Math.max(0, r.syncErrorCount)
        : 0,
    lastErrorAt: typeof r.lastErrorAt === 'string' ? r.lastErrorAt : null,
    lastErrorMessage:
      typeof r.lastErrorMessage === 'string' ? r.lastErrorMessage : null,
    createdAt:
      typeof r.createdAt === 'string' ? r.createdAt : new Date(0).toISOString(),
  };
}

function normalizeOrgDetailOrder(raw: unknown): AdminOrgDetailOrder | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  if (!id) {
    return null;
  }
  return {
    id,
    platform: typeof r.platform === 'string' ? r.platform : '—',
    platformOrderId:
      typeof r.platformOrderId === 'string' ? r.platformOrderId : '—',
    status: typeof r.status === 'string' ? r.status : '—',
    customerName:
      typeof r.customerName === 'string' && r.customerName.trim().length > 0
        ? r.customerName
        : '—',
    totalAmount:
      typeof r.totalAmount === 'string' || typeof r.totalAmount === 'number'
        ? String(r.totalAmount)
        : '0',
    currency: typeof r.currency === 'string' ? r.currency : 'TRY',
    createdAt:
      typeof r.createdAt === 'string' ? r.createdAt : new Date(0).toISOString(),
  };
}

function normalizeOrgDetailAuditEntry(
  raw: unknown,
): AdminOrgDetailAuditEntry | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  if (!id) {
    return null;
  }
  return {
    id,
    action: typeof r.action === 'string' ? r.action : '—',
    resourceType: typeof r.resourceType === 'string' ? r.resourceType : '—',
    resourceId: typeof r.resourceId === 'string' ? r.resourceId : null,
    actorUserId: typeof r.actorUserId === 'string' ? r.actorUserId : '',
    actorOrgId: typeof r.actorOrgId === 'string' ? r.actorOrgId : '',
    impersonatedOrgId:
      typeof r.impersonatedOrgId === 'string' ? r.impersonatedOrgId : null,
    createdAt:
      typeof r.createdAt === 'string' ? r.createdAt : new Date(0).toISOString(),
  };
}

export function normalizeAdminOrgNotes(data: unknown): AdminOrgNote[] {
  return asArray(data)
    .map((raw) => {
      if (raw === null || typeof raw !== 'object') {
        return null;
      }
      const r = raw as Record<string, unknown>;
      const id = typeof r.id === 'string' ? r.id : '';
      if (!id) {
        return null;
      }
      const content =
        typeof r.content === 'string'
          ? r.content
          : typeof r.note === 'string'
            ? r.note
            : '';
      return {
        id,
        orgId: typeof r.orgId === 'string' ? r.orgId : '',
        adminId: typeof r.adminId === 'string' ? r.adminId : '',
        content,
        createdAt:
          typeof r.createdAt === 'string'
            ? r.createdAt
            : new Date(0).toISOString(),
      };
    })
    .filter((n): n is AdminOrgNote => n !== null);
}

export function normalizeAdminActivityItems(data: unknown): AdminActivityItem[] {
  const items: AdminActivityItem[] = [];
  for (const raw of asArray(data)) {
    if (raw === null || typeof raw !== 'object') {
      continue;
    }
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    if (!id) {
      continue;
    }
    items.push({
      id,
      action: typeof r.action === 'string' ? r.action : '—',
      resourceType: typeof r.resourceType === 'string' ? r.resourceType : '—',
      resourceId: typeof r.resourceId === 'string' ? r.resourceId : null,
      actorUserId: typeof r.actorUserId === 'string' ? r.actorUserId : '',
      actorOrgId: typeof r.actorOrgId === 'string' ? r.actorOrgId : '',
      actorOrgName:
        typeof r.actorOrgName === 'string' ? r.actorOrgName : null,
      impersonatedOrgId:
        typeof r.impersonatedOrgId === 'string' ? r.impersonatedOrgId : null,
      impersonatedOrgName:
        typeof r.impersonatedOrgName === 'string'
          ? r.impersonatedOrgName
          : null,
      createdAt:
        typeof r.createdAt === 'string'
          ? r.createdAt
          : r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : new Date(0).toISOString(),
    });
  }
  return items;
}

export function normalizeAdminOrganizationDetail(
  data: Partial<AdminOrganizationDetailResponse> | null | undefined,
): AdminOrganizationDetailResponse {
  const organization = data?.organization;
  if (!organization?.id) {
    throw new Error('Geçersiz organizasyon yanıtı');
  }

  const orgName =
    typeof organization.name === 'string' && organization.name.trim().length > 0
      ? organization.name
      : 'Adsız organizasyon';

  return {
    organization: {
      ...organization,
      name: orgName,
      slug:
        typeof organization.slug === 'string' && organization.slug.trim().length > 0
          ? organization.slug
          : '—',
      suspended: organization.suspended === true,
    },
    subscription: data?.subscription ?? null,
    users: asArray(data?.users)
      .map((u) => normalizeOrgDetailUser(u))
      .filter((u): u is AdminOrgDetailUser => u !== null),
    marketplaceConnections: asArray(data?.marketplaceConnections)
      .map((c) => normalizeOrgDetailConnection(c))
      .filter((c): c is AdminOrgDetailConnection => c !== null),
    erpConnections: asArray(data?.erpConnections)
      .map((c) => normalizeOrgDetailErpConnection(c))
      .filter((c): c is AdminOrgDetailErpConnection => c !== null),
    erpSlotLimit:
      data?.erpSlotLimit === null || typeof data?.erpSlotLimit === 'number'
        ? data.erpSlotLimit
        : null,
    extraErpSlotCount:
      typeof data?.extraErpSlotCount === 'number' ? data.extraErpSlotCount : 0,
    recentOrders: asArray(data?.recentOrders)
      .map((o) => normalizeOrgDetailOrder(o))
      .filter((o): o is AdminOrgDetailOrder => o !== null),
    recentAuditLogs: asArray(data?.recentAuditLogs)
      .map((a) => normalizeOrgDetailAuditEntry(a))
      .filter((a): a is AdminOrgDetailAuditEntry => a !== null),
    payments: asArray(data?.payments),
    orgProducts: asArray(data?.orgProducts),
    accountingMode: data?.accountingMode ?? null,
    activeErpConnectionCount:
      typeof data?.activeErpConnectionCount === 'number'
        ? data.activeErpConnectionCount
        : 0,
    activePartners: asArray(data?.activePartners),
    internalAccount: data?.internalAccount === true,
    billingExempt: data?.billingExempt === true,
  };
}

export function normalizeAdminCohortData(data: unknown): AdminCohortData[] {
  return asArray<Partial<AdminCohortData>>(data).map((row) => ({
    cohortMonth:
      typeof row.cohortMonth === 'string' ? row.cohortMonth : '—',
    cohortSize: typeof row.cohortSize === 'number' ? row.cohortSize : 0,
    retention: asArray(row?.retention),
  }));
}

function normalizePartnerOrgRef(
  raw: unknown,
): { id: string; name: string; slug: string } {
  const o =
    raw !== null && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : {};
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const name =
    typeof o.name === 'string' && o.name.trim().length > 0
      ? o.name.trim()
      : 'Adsız organizasyon';
  const slug =
    typeof o.slug === 'string' && o.slug.trim().length > 0
      ? o.slug.trim()
      : '—';
  return { id, name, slug };
}

function parseCommissionRate(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return 10;
}

/** Tek partner satırı; geçersiz id için null */
export function normalizeAdminPartnerRow(raw: unknown): AdminPartnerRow | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  if (!id) {
    return null;
  }
  const slug =
    typeof r.slug === 'string' && r.slug.trim().length > 0
      ? r.slug.trim()
      : '—';
  const name =
    typeof r.name === 'string' && r.name.trim().length > 0
      ? r.name.trim()
      : 'Adsız partner';
  const createdAt =
    typeof r.createdAt === 'string' && r.createdAt.trim().length > 0
      ? r.createdAt
      : new Date(0).toISOString();

  return {
    id,
    name,
    slug,
    commissionRate: parseCommissionRate(r.commissionRate),
    activeClientCount:
      typeof r.activeClientCount === 'number' && Number.isFinite(r.activeClientCount)
        ? Math.max(0, r.activeClientCount)
        : 0,
    createdAt,
    isDemo:
      r.isDemo === true ||
      (typeof r.slug === 'string' && isDemoPartnerSlug(r.slug)),
  };
}

export function normalizeAdminPartnersList(data: unknown): AdminPartnerRow[] {
  return asArray(data)
    .map((row) => normalizeAdminPartnerRow(row))
    .filter((row): row is AdminPartnerRow => row !== null);
}

const PARTNER_PAYOUT_STATUSES = new Set<AdminPartnerPayoutStatus>([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

function parseAdminFiniteNumber(value: unknown, fallback = 0): number {
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

function normalizeAdminPartnerPayoutStatus(
  value: unknown,
): AdminPartnerPayoutStatus {
  return typeof value === 'string' &&
    PARTNER_PAYOUT_STATUSES.has(value as AdminPartnerPayoutStatus)
    ? (value as AdminPartnerPayoutStatus)
    : 'PENDING';
}

export function normalizeAdminPartnerPayoutRequest(
  raw: unknown,
): AdminPartnerPayoutRequest | null {
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
    amountTRY: parseAdminFiniteNumber(r.amountTRY, 0),
    status: normalizeAdminPartnerPayoutStatus(r.status),
    createdAt,
    reviewedAt:
      typeof r.reviewedAt === 'string' && r.reviewedAt.trim().length > 0
        ? r.reviewedAt
        : null,
  };
}

export function normalizeAdminPartnerPayoutRequests(
  data: unknown,
): AdminPartnerPayoutRequest[] {
  return asArray(data)
    .map((row) => normalizeAdminPartnerPayoutRequest(row))
    .filter((row): row is AdminPartnerPayoutRequest => row !== null);
}

const PARTNER_LINK_STATUSES = new Set<PartnerLinkStatus>([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

function normalizePartnerLinkStatus(value: unknown): PartnerLinkStatus {
  return typeof value === 'string' &&
    PARTNER_LINK_STATUSES.has(value as PartnerLinkStatus)
    ? (value as PartnerLinkStatus)
    : 'PENDING';
}

/** Tek bağlantı talebi; geçersiz id için null */
export function normalizeAdminPartnerLinkRequest(
  raw: unknown,
): AdminPartnerLinkRequest | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  if (!id) {
    return null;
  }

  const clientOrg = normalizePartnerOrgRef(r.clientOrg);
  const partnerOrg = normalizePartnerOrgRef(r.partnerOrg);
  const requestedAt =
    typeof r.requestedAt === 'string' && r.requestedAt.trim().length > 0
      ? r.requestedAt
      : new Date(0).toISOString();

  return {
    id,
    clientOrgId:
      typeof r.clientOrgId === 'string' && r.clientOrgId.trim().length > 0
        ? r.clientOrgId.trim()
        : clientOrg.id,
    partnerOrgId:
      typeof r.partnerOrgId === 'string' && r.partnerOrgId.trim().length > 0
        ? r.partnerOrgId.trim()
        : partnerOrg.id,
    status: normalizePartnerLinkStatus(r.status),
    message: typeof r.message === 'string' ? r.message : null,
    adminNote: typeof r.adminNote === 'string' ? r.adminNote : null,
    requestedAt,
    reviewedAt: typeof r.reviewedAt === 'string' ? r.reviewedAt : null,
    reviewedBy: typeof r.reviewedBy === 'string' ? r.reviewedBy : null,
    clientOrg,
    partnerOrg,
  };
}

export function normalizeAdminPartnerLinkRequestsList(
  data: unknown,
): AdminPartnerLinkRequest[] {
  return asArray(data)
    .map((row) => normalizeAdminPartnerLinkRequest(row))
    .filter((row): row is AdminPartnerLinkRequest => row !== null);
}

function normalizeAdminHealthDate(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

function normalizeAdminHealthErrorRate(value: unknown): number {
  const n = parseAdminFiniteNumber(value, 0);
  if (n > 1 && n <= 100) {
    return Math.min(1, Math.max(0, n / 100));
  }
  return Math.min(1, Math.max(0, n));
}

function normalizeAdminPlatformHealthRow(
  raw: unknown,
): AdminPlatformHealthRow | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const platform =
    typeof r.platform === 'string' && r.platform.trim().length > 0
      ? r.platform.trim()
      : '';
  if (!platform) {
    return null;
  }
  const avgRaw = r.averageSyncDurationMs ?? r.avgSyncDurationMs;
  let averageSyncDurationMs: number | null = null;
  if (avgRaw !== null && avgRaw !== undefined) {
    const ms = parseAdminFiniteNumber(avgRaw, Number.NaN);
    averageSyncDurationMs = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : null;
  }
  return {
    platform,
    activeConnections: Math.max(
      0,
      Math.round(
        parseAdminFiniteNumber(r.activeConnections ?? r.connectionCount, 0),
      ),
    ),
    errorRate24h: normalizeAdminHealthErrorRate(
      r.errorRate24h ?? r.errorRate,
    ),
    averageSyncDurationMs,
    lastSyncAt: normalizeAdminHealthDate(r.lastSyncAt ?? r.lastSync),
  };
}

/** GET /admin/health — eksik alanları güvenli varsayılanlarla doldurur */
export function normalizeAdminHealthStats(
  data: unknown,
): AdminHealthStats {
  const root =
    data !== null && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};
  const platformsSource = root.platforms ?? root.marketplaces ?? data;
  return {
    platforms: asArray(platformsSource)
      .map((row) => normalizeAdminPlatformHealthRow(row))
      .filter((row): row is AdminPlatformHealthRow => row !== null),
  };
}

/** 0–1 kesir veya 0–100 yüzde; geçersizde em dash */
export function formatAdminHealthErrorRate(rate: unknown): string {
  const n = parseAdminFiniteNumber(rate, Number.NaN);
  if (!Number.isFinite(n)) {
    return '—';
  }
  const fraction = normalizeAdminHealthErrorRate(n);
  return `${(fraction * 100).toLocaleString('tr-TR', {
    minimumFractionDigits: fraction === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function normalizeAdminPlatformStats(
  data: Partial<AdminPlatformStats> | null | undefined,
): AdminPlatformStats {
  const d = data ?? {};
  return {
    totalOrganizations: d.totalOrganizations ?? 0,
    activeOrganizations: d.activeOrganizations ?? 0,
    inactiveOrganizations: d.inactiveOrganizations ?? 0,
    totalUsers: d.totalUsers ?? 0,
    planDistribution: asArray(d.planDistribution),
    productLineDistribution: asArray(d.productLineDistribution),
    accountingModeDistribution: asArray(d.accountingModeDistribution),
    trialActiveOrganizations: d.trialActiveOrganizations ?? 0,
    newRegistrationsLast30Days: d.newRegistrationsLast30Days ?? 0,
    ordersThisMonthCount: d.ordersThisMonthCount ?? 0,
    activeMarketplaceConnections: d.activeMarketplaceConnections ?? 0,
    platformHealthScore: d.platformHealthScore ?? 0,
    dailyNewRegistrations: asArray(d.dailyNewRegistrations),
  };
}
