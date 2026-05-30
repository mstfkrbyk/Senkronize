import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ErpSyncSettingsTab } from './tabs/ErpSyncSettingsTab';

export function ErpSyncSettingsPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.tabs.erpSync'));
  return <ErpSyncSettingsTab />;
}
