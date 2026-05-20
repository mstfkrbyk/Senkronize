import { useMemo } from 'react';

import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useAuthStore } from '@/store/auth.store';

import {
  defaultSettingsTab,
  resolveSettingsSections,
  visibleSettingsTabIds,
  type SettingsSectionDefinition,
  type SettingsTabId,
} from './settings-tabs.config';

export interface UseSettingsTabGroupsResult {
  sections: SettingsSectionDefinition[];
  visibleTabIds: SettingsTabId[];
  defaultTab: SettingsTabId;
  accountingModeLoading: boolean;
}

export function useSettingsTabGroups(
  preferredTab?: string | null,
): UseSettingsTabGroupsResult {
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode, isLoading: accountingModeLoading } = useAccountingMode();

  const sections = useMemo(
    () => resolveSettingsSections(orgProducts, mode),
    [orgProducts, mode],
  );

  const visibleTabIds = useMemo(
    () => visibleSettingsTabIds(sections),
    [sections],
  );

  const defaultTab = useMemo(
    () => defaultSettingsTab(sections, preferredTab),
    [sections, preferredTab],
  );

  return {
    sections,
    visibleTabIds,
    defaultTab,
    accountingModeLoading,
  };
}
