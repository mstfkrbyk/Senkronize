import type { NavGroupId } from '@/constants/navigation';
import type { AccountingMode } from '@/lib/accounting-mode';
import {
  showExternalErpTab,
  usesExternalIntegrationsNavSection,
  type ConnectionsProductAccess,
} from '@/pages/connections/connections-product-access';

export type SyncLogsScopeTab = 'channel' | 'erp';

/**
 * Sync durumu üst bağlamı: harici ERP modunda entegrasyon menüsü → externalErp;
 * yerel modda kanal sekmesi → ecommerce.
 */
export function resolveSyncLogsNavGroupId(
  access: ConnectionsProductAccess,
  accountingMode: AccountingMode,
  scopeTab: SyncLogsScopeTab,
): NavGroupId {
  if (usesExternalIntegrationsNavSection(access, accountingMode)) {
    return 'externalErp';
  }

  const erpTabActive = scopeTab === 'erp';
  if (erpTabActive && showExternalErpTab(access, accountingMode)) {
    return 'externalErp';
  }

  return 'ecommerce';
}
