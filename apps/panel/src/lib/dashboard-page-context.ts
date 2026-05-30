import type { AccountingMode } from '@/lib/accounting-mode';
import {
  hasOrgProductLine,
  isAccountingOnlyOrg,
  isIntegrationOnlyOrg,
} from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

export type DashboardSubtitleKey =
  | 'dashboard.subtitle.integration'
  | 'dashboard.subtitle.hybridNative'
  | 'dashboard.subtitle.hybridExternalErp';

export interface DashboardProductAccess {
  hasIntegration: boolean;
  hasAccounting: boolean;
  accountingOnly: boolean;
  integrationOnly: boolean;
}

export function resolveDashboardProductAccess(
  orgProducts: OrgProductLine[] | undefined,
): DashboardProductAccess {
  const hasIntegration = hasOrgProductLine(orgProducts, 'INTEGRATION');
  const hasAccounting = hasOrgProductLine(orgProducts, 'ACCOUNTING');

  return {
    hasIntegration,
    hasAccounting,
    accountingOnly: isAccountingOnlyOrg(orgProducts),
    integrationOnly: isIntegrationOnlyOrg(orgProducts),
  };
}

/** Gösterge paneli alt başlığı — ürün hattı ve muhasebe moduna göre */
export function resolveDashboardSubtitleKey(
  access: DashboardProductAccess,
  accountingMode: AccountingMode,
): DashboardSubtitleKey {
  if (access.integrationOnly) {
    return 'dashboard.subtitle.integration';
  }
  if (accountingMode === 'EXTERNAL_ERP') {
    return 'dashboard.subtitle.hybridExternalErp';
  }
  return 'dashboard.subtitle.hybridNative';
}
