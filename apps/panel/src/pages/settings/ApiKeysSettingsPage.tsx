import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ApiKeysTab } from './tabs/ApiKeysTab';

export function ApiKeysSettingsPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.tabs.apiKeys'));
  return <ApiKeysTab />;
}
