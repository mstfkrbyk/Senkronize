import type { TFunction } from 'i18next';

import i18n from '@/i18n';
import type { SubStatus } from '@/types/admin';
import type { AdminProductSelection } from '@/types/admin';
import type { AccountingMode, OrgPlanTier, OrgProductLine } from '@/types/auth';

type Translate = TFunction;

function defaultTranslate(key: string, options?: string | Record<string, unknown>): string {
  if (options !== undefined && typeof options === 'object') {
    return i18n.t(key, { lng: 'tr', ...options });
  }
  return i18n.t(key, {
    lng: 'tr',
    defaultValue: typeof options === 'string' ? options : undefined,
  });
}

function resolveT(t?: Translate): Translate {
  if (t) {
    return t;
  }
  return defaultTranslate as Translate;
}

export function adminOrgTypeLabel(type: string, t?: Translate): string {
  return resolveT(t)(`admin.orgType.${type}`, { defaultValue: type });
}

export function adminUserRoleLabel(role: string, t?: Translate): string {
  return resolveT(t)(`admin.userRole.${role}`, { defaultValue: role });
}

export function adminSubscriptionStatusLabel(
  status: string,
  t?: Translate,
): string {
  return resolveT(t)(`admin.subscriptionStatus.${status}`, {
    defaultValue: status,
  });
}

export const ADMIN_SUBSCRIPTION_STATUSES: SubStatus[] = [
  'TRIAL',
  'ACTIVE',
  'PAUSED',
  'CANCELING',
  'CANCELLED',
  'EXPIRED',
];

export function adminPlanTierLabel(plan: string, t?: Translate): string {
  return resolveT(t)(`admin.planTier.${plan}`, { defaultValue: plan });
}

export const ADMIN_PLAN_TIERS: OrgPlanTier[] = [
  'BASLANGIC',
  'GELISIM',
  'PRO',
  'KURUMSAL',
];

export function adminPaymentStatusLabel(status: string, t?: Translate): string {
  return resolveT(t)(`admin.paymentStatus.${status}`, { defaultValue: status });
}

export function adminProductSelectionLabel(
  value: AdminProductSelection,
  t?: Translate,
): string {
  return resolveT(t)(`admin.productSelection.${value}`, { defaultValue: value });
}

export const ADMIN_PRODUCT_SELECTIONS: AdminProductSelection[] = [
  'INTEGRATION',
  'ACCOUNTING',
  'BUNDLE',
];

export function adminProductLineLabel(
  line: OrgProductLine,
  t?: Translate,
): string {
  return resolveT(t)(`admin.productLine.${line}`, { defaultValue: line });
}

export function adminAccountStatusLabel(
  suspended: boolean,
  t?: Translate,
): string {
  const key = suspended ? 'admin.accountStatus.suspended' : 'admin.accountStatus.active';
  return resolveT(t)(key);
}

export function adminAccountingModeLabel(
  mode: AccountingMode,
  t?: Translate,
): string {
  return resolveT(t)(`admin.accountingMode.${mode}`, { defaultValue: mode });
}

export function adminNoSubscriptionLabel(t?: Translate): string {
  return resolveT(t)('admin.noSubscription');
}

export function adminPartnerLinkStatusLabel(
  status: string,
  t?: Translate,
): string {
  return resolveT(t)(`admin.partnerLinkStatus.${status}`, {
    defaultValue: resolveT(t)('admin.partnerLinkStatus.unknown'),
  });
}

export function adminPartnerPayoutStatusLabel(
  status: string,
  t?: Translate,
): string {
  return resolveT(t)(`admin.partnerPayoutStatus.${status}`, {
    defaultValue: status,
  });
}
