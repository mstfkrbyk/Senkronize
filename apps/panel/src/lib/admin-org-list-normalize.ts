import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

import {
  ADMIN_ACCOUNTING_MODE_LABEL,
  adminAccountingModeBadgeClass,
} from '@/lib/admin-accounting-mode';
import type { AccountingMode, OrgProductLine } from '@/types/auth';
import type { AdminOrganizationRow } from '@/types/admin';

const DEFAULT_ORG_PRODUCT_LINES: OrgProductLine[] = ['INTEGRATION', 'ACCOUNTING'];

function normalizeOrgProducts(raw: OrgProductLine[] | undefined): OrgProductLine[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_ORG_PRODUCT_LINES];
  }
  return raw.filter(
    (line): line is OrgProductLine => line === 'INTEGRATION' || line === 'ACCOUNTING',
  );
}

function isAccountingMode(value: unknown): value is AccountingMode {
  return value === 'NATIVE' || value === 'EXTERNAL_ERP';
}

/** API / eski kayıtlar için çözümlenen muhasebe modu */
export function resolveAdminListAccountingMode(
  mode: unknown,
): AccountingMode {
  if (isAccountingMode(mode)) {
    return mode;
  }
  return 'NATIVE';
}

export function formatAdminAccountingModeLabel(mode: unknown): string {
  return ADMIN_ACCOUNTING_MODE_LABEL[resolveAdminListAccountingMode(mode)];
}

export function adminAccountingModeBadgeClassSafe(mode: unknown): string {
  return adminAccountingModeBadgeClass(resolveAdminListAccountingMode(mode));
}

const ADMIN_MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function formatAdminOrgDate(
  value: string | null | undefined,
  pattern: string,
): string {
  if (!value) {
    return '—';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return format(d, pattern, { locale: tr });
}

/** YYYY-MM ay anahtarı; geçersizse null (grafikte atlanır). */
export function formatAdminMonthKeyLabel(
  monthKey: string | null | undefined,
  pattern: string,
): string | null {
  if (!monthKey || !ADMIN_MONTH_KEY_RE.test(monthKey)) {
    return null;
  }
  const formatted = formatAdminOrgDate(`${monthKey}-01`, pattern);
  return formatted === '—' ? null : formatted;
}

/** Liste ve CSV için satır normalizasyonu */
export function normalizeAdminOrganizationRow(
  raw: AdminOrganizationRow,
): AdminOrganizationRow {
  const partners = Array.isArray(raw.activePartners) ? raw.activePartners : [];
  const count = raw._count ?? {
    users: 0,
    marketplaceConnections: 0,
    orders: 0,
  };

  return {
    ...raw,
    orgProducts: normalizeOrgProducts(raw.orgProducts),
    activePartners: partners,
    accountingMode: resolveAdminListAccountingMode(raw.accountingMode),
    _count: {
      users: count.users ?? 0,
      marketplaceConnections: count.marketplaceConnections ?? 0,
      orders: count.orders ?? 0,
    },
  };
}
