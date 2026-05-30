import type { AccountingMode } from '@/lib/accounting-mode';
import { hasOrgProductLine } from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

export interface ConnectionsProductAccess {
  hasIntegration: boolean;
  hasAccounting: boolean;
  accountingOnly: boolean;
  integrationOnly: boolean;
  showIntegrationTabs: boolean;
  showErpBridge: boolean;
}

export function resolveConnectionsProductAccess(
  orgProducts: OrgProductLine[] | undefined,
): ConnectionsProductAccess {
  const hasIntegration = hasOrgProductLine(orgProducts, 'INTEGRATION');
  const hasAccounting = hasOrgProductLine(orgProducts, 'ACCOUNTING');

  return {
    hasIntegration,
    hasAccounting,
    accountingOnly: hasAccounting && !hasIntegration,
    integrationOnly: hasIntegration && !hasAccounting,
    showIntegrationTabs: hasIntegration,
    showErpBridge: hasIntegration || hasAccounting,
  };
}

/** Harici ERP sekmesi / köprü UI — yalnızca EXTERNAL_ERP modunda (yerel ön muhasebede gizli). */
export function showExternalErpTab(
  access: ConnectionsProductAccess,
  accountingMode: AccountingMode,
): boolean {
  if (!access.showErpBridge || access.accountingOnly) {
    return false;
  }
  return accountingMode === 'EXTERNAL_ERP';
}

export function showExternalErpBridgeUi(
  access: ConnectionsProductAccess,
  accountingMode: AccountingMode,
): boolean {
  if (!access.showErpBridge || access.accountingOnly) {
    return false;
  }
  return accountingMode === 'EXTERNAL_ERP';
}

/** Entegrasyon/senkron menüsü e-ticaret yerine harici ERP grubunda gösterilir. */
export function usesExternalIntegrationsNavSection(
  access: ConnectionsProductAccess,
  accountingMode: AccountingMode,
): boolean {
  if (accountingMode !== 'EXTERNAL_ERP') {
    return false;
  }
  if (access.accountingOnly) {
    return true;
  }
  return access.showIntegrationTabs;
}
