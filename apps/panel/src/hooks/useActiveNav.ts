import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import type { NavGroupId, NavItem } from '@/constants/navigation';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useIntegrationOpsAccess } from '@/hooks/useIntegrationOpsAccess';
import {
  isErpSetupPath,
  resolveConnectionDetailNavGroup,
} from '@/lib/connection-detail-nav';
import { ERP_SETUP_PAGE_LABEL } from '@/pages/connections/erp-setup-nav-context';
import {
  buildVisibleNavCatalog,
  findActiveNavItem,
  NAV_GROUP_LABEL_KEYS,
} from '@/lib/nav-match';
import { useAuthStore } from '@/store/auth.store';

export interface ActiveNavState {
  item: NavItem | undefined;
  group: NavGroupId | undefined;
  groupLabel: string | undefined;
  pageLabel: string | undefined;
}

export function useActiveNav(): ActiveNavState {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const canViewIntegrationOps = useIntegrationOpsAccess();

  return useMemo(() => {
    const catalog = buildVisibleNavCatalog({
      orgType,
      orgProducts,
      accountingMode,
      canViewIntegrationOps,
    });
    const item = findActiveNavItem(pathname, search, catalog);
    const erpSetup = isErpSetupPath(pathname);
    const connectionDetailGroup = resolveConnectionDetailNavGroup(pathname);
    const group = connectionDetailGroup ?? item?.group;
    const groupLabel = group ? t(NAV_GROUP_LABEL_KEYS[group]) : undefined;
    const pageLabel = erpSetup
      ? ERP_SETUP_PAGE_LABEL
      : item
        ? t(item.labelKey)
        : undefined;

    return { item, group, groupLabel, pageLabel };
  }, [pathname, search, orgType, orgProducts, accountingMode, canViewIntegrationOps, t]);
}
