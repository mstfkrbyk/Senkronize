import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AppearanceTab } from './tabs/AppearanceTab';

export function AppearanceSettingsPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.tabs.appearance'));
  return <AppearanceTab />;
}
