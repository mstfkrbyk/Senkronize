import type { AccountingMode } from '@/lib/accounting-mode';
import { hasOrgProductLine } from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

export const REPORT_TAB_IDS = [
  'sales',
  'profit',
  'tax',
  'analytics',
  'custom',
  'schedule',
  'erp-transfer',
] as const;

export type ReportTabId = (typeof REPORT_TAB_IDS)[number];

export interface ReportTabDefinition {
  id: ReportTabId;
  labelKey: string;
}

const TAB_LABELS: Record<ReportTabId, string> = {
  sales: 'reports.tabs.sales',
  profit: 'reports.tabs.profit',
  tax: 'reports.tabs.tax',
  analytics: 'reports.tabs.analytics',
  custom: 'reports.tabs.custom',
  schedule: 'reports.tabs.schedule',
  'erp-transfer': 'reports.tabs.erpTransfer',
};

const NATIVE_ACCOUNTING_TAB_ORDER: ReportTabId[] = [
  'sales',
  'profit',
  'tax',
  'custom',
];

const INTEGRATION_ECOMMERCE_TAB_ORDER: ReportTabId[] = [
  'sales',
  'profit',
  'analytics',
  'schedule',
];

function toDefinitions(ids: ReportTabId[]): ReportTabDefinition[] {
  return ids.map((id) => ({ id, labelKey: TAB_LABELS[id] }));
}

export interface ReportsProductAccess {
  hasIntegration: boolean;
  hasAccounting: boolean;
  accountingOnly: boolean;
  integrationOnly: boolean;
}

export function resolveReportsProductAccess(
  orgProducts: OrgProductLine[] | undefined,
): ReportsProductAccess {
  const hasIntegration = hasOrgProductLine(orgProducts, 'INTEGRATION');
  const hasAccounting = hasOrgProductLine(orgProducts, 'ACCOUNTING');

  return {
    hasIntegration,
    hasAccounting,
    accountingOnly: hasAccounting && !hasIntegration,
    integrationOnly: hasIntegration && !hasAccounting,
  };
}

export function resolveReportsTabs(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): ReportTabDefinition[] {
  const access = resolveReportsProductAccess(orgProducts);
  const { hasIntegration, hasAccounting, accountingOnly, integrationOnly } =
    access;
  const externalErp = accountingMode === 'EXTERNAL_ERP';

  if (integrationOnly) {
    return toDefinitions(INTEGRATION_ECOMMERCE_TAB_ORDER);
  }

  if (accountingOnly) {
    if (externalErp) {
      return toDefinitions(['erp-transfer']);
    }
    return toDefinitions(NATIVE_ACCOUNTING_TAB_ORDER);
  }

  if (externalErp) {
    const ids: ReportTabId[] = [];
    if (hasIntegration) {
      ids.push('sales', 'profit', 'schedule');
      if (resolveAnalyticsTabVisible(access)) {
        ids.push('analytics');
      }
    }
    ids.push('erp-transfer');
    return toDefinitions(ids);
  }

  const ids: ReportTabId[] = [];
  if (hasAccounting) {
    ids.push(...NATIVE_ACCOUNTING_TAB_ORDER);
  } else if (hasIntegration) {
    ids.push('sales', 'profit');
  }
  if (hasIntegration) {
    if (resolveAnalyticsTabVisible(access)) {
      ids.push('analytics');
    }
    ids.push('schedule');
  }
  return toDefinitions(ids);
}

export function resolveReportsSubtitleKey(
  access: ReportsProductAccess,
  accountingMode: AccountingMode,
): string {
  if (access.integrationOnly) {
    return 'reports.subtitle.integration';
  }
  if (access.accountingOnly) {
    return accountingMode === 'EXTERNAL_ERP'
      ? 'reports.subtitle.externalErp'
      : 'reports.subtitle.nativeAccounting';
  }
  if (accountingMode === 'EXTERNAL_ERP') {
    return 'reports.subtitle.hybridExternalErp';
  }
  return 'reports.subtitle.hybridNative';
}

export type ReportExternalErpPresentation = 'full' | 'externalErpNotice';

export type ProfitReportPresentation = ReportExternalErpPresentation;
export type TaxReportPresentation = ReportExternalErpPresentation;
export type CustomReportPresentation = ReportExternalErpPresentation;
export type AnalyticsReportPresentation = ReportExternalErpPresentation;
export type ScheduleReportPresentation = ReportExternalErpPresentation;
export type SalesReportPresentation = ReportExternalErpPresentation;

/** Zamanlama sekmesi: entegrasyon hattı; muhasebe-only org'da sekme yok. */
export function resolveScheduleTabVisible(
  access: ReportsProductAccess,
): boolean {
  return access.hasIntegration && !access.accountingOnly;
}

/** Zamanlanmış raporlar: entegrasyon satış/kâr; harici ERP + muhasebe hattında bilgilendirme. */
export function resolveScheduleReportPresentation(
  access: ReportsProductAccess,
  accountingMode: AccountingMode,
): ScheduleReportPresentation {
  return resolveAccountingExternalErpPresentation(access, accountingMode);
}

/** Zamanlama oluşturucuda ve listede gösterilen rapor tipleri (muhasebe tipleri hariç). */
export const INTEGRATION_SCHEDULE_REPORT_TYPES = ['SALES', 'PROFIT'] as const;

export type IntegrationScheduleReportType =
  (typeof INTEGRATION_SCHEDULE_REPORT_TYPES)[number];

export function isIntegrationScheduleReportType(
  reportType: string,
): reportType is IntegrationScheduleReportType {
  return (INTEGRATION_SCHEDULE_REPORT_TYPES as readonly string[]).includes(
    reportType,
  );
}

/** Platform analitiği: entegrasyon hattı gerekir; muhasebe-only org'da sekme yok. */
export function resolveAnalyticsTabVisible(
  access: ReportsProductAccess,
): boolean {
  return access.hasIntegration && !access.accountingOnly;
}

function resolveAccountingExternalErpPresentation(
  access: ReportsProductAccess,
  accountingMode: AccountingMode,
): ReportExternalErpPresentation {
  if (access.hasAccounting && accountingMode === 'EXTERNAL_ERP') {
    return 'externalErpNotice';
  }
  return 'full';
}

/**
 * Satış raporu: pazaryeri verisi — BUNDLE ve yalnız entegrasyonda tam.
 * Harici ERP + yalnız muhasebe hattında bilgilendirme (sekme genelde görünmez).
 */
export function resolveSalesReportPresentation(
  access: ReportsProductAccess,
  accountingMode: AccountingMode,
): SalesReportPresentation {
  if (
    access.accountingOnly &&
    access.hasAccounting &&
    accountingMode === 'EXTERNAL_ERP'
  ) {
    return 'externalErpNotice';
  }
  return 'full';
}

/** Kâr/zarar içeriği: NATIVE veya yalnız entegrasyon; harici ERP + muhasebe hattında bilgilendirme. */
export function resolveProfitReportPresentation(
  access: ReportsProductAccess,
  accountingMode: AccountingMode,
): ProfitReportPresentation {
  return resolveAccountingExternalErpPresentation(access, accountingMode);
}

/** KDV özeti: NATIVE tam rapor; harici ERP + muhasebe hattında bilgilendirme. */
export function resolveTaxReportPresentation(
  access: ReportsProductAccess,
  accountingMode: AccountingMode,
): TaxReportPresentation {
  return resolveAccountingExternalErpPresentation(access, accountingMode);
}

/** Özel rapor oluşturucu: NATIVE tam builder; harici ERP + muhasebe hattında bilgilendirme. */
export function resolveCustomReportPresentation(
  access: ReportsProductAccess,
  accountingMode: AccountingMode,
): CustomReportPresentation {
  return resolveAccountingExternalErpPresentation(access, accountingMode);
}

/** Platform analitiği: entegrasyon verisi; harici ERP + muhasebe hattında bilgilendirme. */
export function resolveAnalyticsReportPresentation(
  access: ReportsProductAccess,
  accountingMode: AccountingMode,
): AnalyticsReportPresentation {
  return resolveAccountingExternalErpPresentation(access, accountingMode);
}

export function defaultReportTab(tabs: ReportTabDefinition[]): ReportTabId {
  return tabs[0]?.id ?? 'sales';
}

export function isReportTabId(
  value: string | null | undefined,
  tabs: ReportTabDefinition[],
): value is ReportTabId {
  return (
    value != null && tabs.some((tab) => tab.id === value)
  );
}
