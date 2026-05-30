import { format } from 'date-fns';
import type { TFunction } from 'i18next';

import i18n from '@/i18n';
import {
  adminAccountStatusLabel,
  adminAccountingModeLabel,
  adminPlanTierLabel,
  adminProductLineLabel,
  adminSubscriptionStatusLabel,
} from '@/lib/admin-i18n-labels';
import { formatAdminOrgDate, normalizeAdminOrganizationRow } from '@/lib/admin-org-list-normalize';
import { hasOrgProductLine } from '@/lib/org-products';
import { sanitizeCsvText } from '@/lib/sanitize-csv-text';
import type { AdminOrganizationRow } from '@/types/admin';
import type { OrgProductLine } from '@/types/auth';

type Translate = TFunction;

function resolveT(t?: Translate): Translate {
  if (t) {
    return t;
  }
  return ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { lng: 'tr', ...options })) as Translate;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function getAdminPartnerClientsCsvHeaders(t?: Translate): string[] {
  const tr = resolveT(t);
  return [
    tr('admin.pages.partnerClients.csv.organization'),
    tr('admin.pages.partnerClients.csv.slug'),
    tr('admin.pages.partnerClients.csv.products'),
    tr('admin.pages.partnerClients.csv.accounting'),
    tr('admin.pages.partnerClients.csv.plan'),
    tr('admin.pages.partnerClients.csv.accountStatus'),
    tr('admin.pages.partnerClients.csv.subscription'),
    tr('admin.pages.partnerClients.csv.registered'),
  ];
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

function orgToCsvRow(raw: AdminOrganizationRow, t: Translate): string[] {
  const org = normalizeAdminOrganizationRow(raw);
  const emDash = resolveT(t)('admin.common.emDash');
  const plan = org.subscription
    ? adminPlanTierLabel(org.subscription.plan, t)
    : emDash;
  const subscription = org.subscription
    ? adminSubscriptionStatusLabel(org.subscription.status, t)
    : emDash;

  return [
    sanitizeCsvText(org.name),
    sanitizeCsvText(org.slug ?? ''),
    formatOrgProducts(org.orgProducts, t),
    adminAccountingModeLabel(org.accountingMode, t),
    plan,
    adminAccountStatusLabel(org.suspended, t),
    subscription,
    formatAdminOrgDate(org.createdAt, 'yyyy-MM-dd'),
  ];
}

export function adminPartnerClientsToCsv(
  rows: AdminOrganizationRow[],
  t?: Translate,
): string {
  const tr = resolveT(t);
  const headers = getAdminPartnerClientsCsvHeaders(tr);
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((org) =>
      orgToCsvRow(org, tr).map((cell) => escapeCsvCell(cell)).join(','),
    ),
  ];
  return lines.join('\n');
}

export function defaultAdminPartnerClientsCsvFilename(t?: Translate): string {
  const tr = resolveT(t);
  const date = format(new Date(), 'yyyy-MM-dd');
  return tr('admin.pages.partnerClients.filename', { date });
}

export function downloadAdminPartnerClientsCsv(
  rows: AdminOrganizationRow[],
  filename?: string,
  t?: Translate,
): void {
  const tr = resolveT(t);
  const csv = '\uFEFF' + adminPartnerClientsToCsv(rows, tr);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? defaultAdminPartnerClientsCsvFilename(tr);
  a.click();
  URL.revokeObjectURL(url);
}
