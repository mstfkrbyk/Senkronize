import type { NavGroupId } from '@/constants/navigation';
import type { AccountingMode } from '@/lib/accounting-mode';

import {
  showExternalErpTab,
  usesExternalIntegrationsNavSection,
  type ConnectionsProductAccess,
} from './connections-product-access';
import type { ConnectionTabId } from './connections-tabs.config';

/**
 * Bağlantılar sayfası üst bağlamı: harici ERP modunda entegrasyon menüsü → externalErp;
 * yerel modda kanal sekmeleri → ecommerce.
 */
export function resolveConnectionsNavGroupId(
  access: ConnectionsProductAccess,
  accountingMode: AccountingMode,
  mainTab: ConnectionTabId,
  urlTab: string | null,
): NavGroupId {
  if (access.accountingOnly && usesExternalIntegrationsNavSection(access, accountingMode)) {
    return 'externalErp';
  }

  const erpTabActive = mainTab === 'erp' || urlTab === 'erp';
  if (erpTabActive && showExternalErpTab(access, accountingMode)) {
    return 'externalErp';
  }

  if (access.showIntegrationTabs && !erpTabActive) {
    return 'ecommerce';
  }

  if (usesExternalIntegrationsNavSection(access, accountingMode)) {
    return 'externalErp';
  }

  return 'ecommerce';
}
