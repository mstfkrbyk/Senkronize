import { useMemo } from 'react';

import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import type { OrgType } from '@/types/auth';

import {
  defaultInlineSettingsTab,
  resolveSettingsProductAccess,
  resolveSettingsSections,
  visibleSettingsTabIds,
  wantsIntegrationSettingsDeepLink,
  type SettingsProductAccess,
  type SettingsSectionDefinition,
  type SettingsTabId,
} from './settings-tabs.config';

export interface UseSettingsTabGroupsResult {
  sections: SettingsSectionDefinition[];
  visibleTabIds: SettingsTabId[];
  defaultTab: SettingsTabId;
  productAccess: SettingsProductAccess;
  integrationDeepLink: boolean;
  accountingModeLoading: boolean;
}

function resolveSettingsOrgType(
  meOrgType?: OrgType,
  storeOrgType?: OrgType,
): OrgType | undefined {
  return meOrgType ?? storeOrgType;
}

export function useSettingsTabGroups(
  preferredTab?: string | null,
): UseSettingsTabGroupsResult {
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const storeOrgType = useAuthStore((s) => s.currentOrg?.type);
  const { data: me } = useAuth();
  const { mode, isLoading: accountingModeLoading } = useAccountingMode();
  const orgType = resolveSettingsOrgType(me?.organization?.type, storeOrgType);

  const productAccess = useMemo(
    () => resolveSettingsProductAccess(orgProducts),
    [orgProducts],
  );

  const sections = useMemo(
    () => resolveSettingsSections(orgProducts, mode, orgType),
    [orgProducts, mode, orgType],
  );

  const visibleTabIds = useMemo(
    () => visibleSettingsTabIds(sections),
    [sections],
  );

  const defaultTab = useMemo(
    () => defaultInlineSettingsTab(sections, preferredTab),
    [sections, preferredTab],
  );

  const integrationDeepLink = useMemo(
    () => wantsIntegrationSettingsDeepLink(preferredTab, productAccess),
    [preferredTab, productAccess],
  );

  return {
    sections,
    visibleTabIds,
    defaultTab,
    productAccess,
    integrationDeepLink,
    accountingModeLoading,
  };
}
