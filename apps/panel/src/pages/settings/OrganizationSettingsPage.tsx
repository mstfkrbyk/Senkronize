import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@/hooks/usePageTitle';
import { OrganizationTab } from './tabs/OrganizationTab';

export function OrganizationSettingsPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.tabs.organization'));
  return <OrganizationTab />;
}
