import { format } from 'date-fns';
import type { TFunction } from 'i18next';

import i18n from '@/i18n';
import { normalizeAdminOrgListResponse } from '@/lib/admin-api-normalize';
import {
  adminAccountStatusLabel,
  adminAccountingModeLabel,
  adminPlanTierLabel,
  adminProductLineLabel,
  adminSubscriptionStatusLabel,
} from '@/lib/admin-i18n-labels';
import { formatAdminOrgDate, normalizeAdminOrganizationRow } from '@/lib/admin-org-list-normalize';
import { api } from '@/lib/api';
import { sanitizeCsvText } from '@/lib/sanitize-csv-text';
import { hasOrgProductLine } from '@/lib/org-products';
import type { AdminOrgListResponse, AdminOrganizationRow } from '@/types/admin';
import type { OrgProductLine } from '@/types/auth';

type Translate = TFunction;

function resolveT(t?: Translate): Translate {
  if (t) {
    return t;
  }
  return ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { lng: 'tr', ...options })) as Translate;
}

export function getAdminOrgsCsvHeaders(t?: Translate): string[] {
  const tr = resolveT(t);
  return [
    tr('admin.organizations.csv.organization'),
    tr('admin.organizations.csv.taxNumber'),
    tr('admin.organizations.csv.products'),
    tr('admin.organizations.csv.accounting'),
    tr('admin.organizations.csv.partner'),
    tr('admin.organizations.csv.plan'),
    tr('admin.organizations.csv.accountStatus'),
    tr('admin.organizations.csv.subscription'),
    tr('admin.organizations.csv.trialEnd'),
    tr('admin.organizations.csv.orders'),
    tr('admin.organizations.csv.registered'),
    tr('admin.organizations.csv.lastActivity'),
  ];
}

/** @deprecated Use getAdminOrgsCsvHeaders(t) for locale-aware headers. */
export const ADMIN_ORGS_CSV_HEADERS = getAdminOrgsCsvHeaders();

const EXPORT_PAGE_LIMIT = 100;

export interface AdminOrgsExportFilters {
  search: string;
  plan: string;
  status: string;
  product: string;
  accountingMode: string;
  partnerId: string | null;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function formatOrgProducts(orgProducts: OrgProductLine[], t: Translate): string {
  const parts: string[] = [];
  if (hasOrgProductLine(orgProducts, 'INTEGRATION')) {
    parts.push(adminProductLineLabel('INTEGRATION', t));
  }
  if (hasOrgProductLine(orgProducts, 'ACCOUNTING')) {
    parts.push(adminProductLineLabel('ACCOUNTING', t));
  }
  return parts.length > 0 ? parts.join(' + ') : resolveT(t)('admin.common.emDash');
}

function formatSubscription(org: AdminOrganizationRow, t: Translate): string {
  if (!org.subscription) {
    return resolveT(t)('admin.common.emDash');
  }
  return adminSubscriptionStatusLabel(org.subscription.status, t);
}

function formatTrialEnd(org: AdminOrganizationRow): string {
  if (org.subscription?.status !== 'TRIAL' || !org.subscription.trialEndsAt) {
    return '';
  }
  const formatted = formatAdminOrgDate(org.subscription.trialEndsAt, 'yyyy-MM-dd');
  return formatted === '—' ? '' : formatted;
}

function orgToCsvRow(raw: AdminOrganizationRow, t: Translate): string[] {
  const org = normalizeAdminOrganizationRow(raw);
  const emDash = resolveT(t)('admin.common.emDash');
  const partners =
    org.activePartners.length > 0
      ? org.activePartners
          .map((p) => sanitizeCsvText(p.name))
          .filter((name) => name.length > 0)
          .join('; ')
      : emDash;
  const plan = org.subscription
    ? adminPlanTierLabel(org.subscription.plan, t)
    : emDash;

  return [
    sanitizeCsvText(org.name),
    sanitizeCsvText(org.taxNumber ?? ''),
    formatOrgProducts(org.orgProducts, t),
    adminAccountingModeLabel(org.accountingMode, t),
    partners,
    plan,
    adminAccountStatusLabel(org.suspended, t),
    formatSubscription(org, t),
    formatTrialEnd(org),
    String(org._count.orders ?? 0),
    formatAdminOrgDate(org.createdAt, 'yyyy-MM-dd'),
    formatAdminOrgDate(org.lastActivityAt, 'yyyy-MM-dd HH:mm'),
  ];
}

export function adminOrgsToCsv(rows: AdminOrganizationRow[], t?: Translate): string {
  const tr = resolveT(t);
  const headers = getAdminOrgsCsvHeaders(tr);
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((org) =>
      orgToCsvRow(org, tr).map((cell) => escapeCsvCell(cell)).join(','),
    ),
  ];
  return lines.join('\n');
}

export function defaultAdminOrgsCsvFilename(t?: Translate): string {
  const tr = resolveT(t);
  const date = format(new Date(), 'yyyy-MM-dd');
  return tr('admin.organizations.csv.filename', { date });
}

export function downloadAdminOrgsCsv(
  rows: AdminOrganizationRow[],
  filename?: string,
  t?: Translate,
): void {
  const tr = resolveT(t);
  const csv = '\uFEFF' + adminOrgsToCsv(rows, tr);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? defaultAdminOrgsCsvFilename(tr);
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchFilteredAdminOrgsForExport(
  filters: AdminOrgsExportFilters,
): Promise<AdminOrganizationRow[]> {
  const all: AdminOrganizationRow[] = [];
  let page = 1;
  let total = 0;

  do {
    const { data } = await api.get<AdminOrgListResponse>('/admin/organizations', {
      params: {
        page,
        limit: EXPORT_PAGE_LIMIT,
        search: filters.search || undefined,
        plan: filters.plan === 'all' ? undefined : filters.plan,
        status: filters.status === 'all' ? undefined : filters.status,
        product: filters.product === 'all' ? undefined : filters.product,
        accountingMode:
          filters.accountingMode === 'all' ? undefined : filters.accountingMode,
        partner: filters.partnerId ?? undefined,
      },
    });
    const normalized = normalizeAdminOrgListResponse(data);
    all.push(...normalized.orgs);
    total = normalized.total;
    page += 1;
  } while (all.length < total);

  return all;
}
