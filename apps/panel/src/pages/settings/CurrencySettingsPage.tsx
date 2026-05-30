import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CurrencyTab } from './tabs/CurrencyTab';

export function CurrencySettingsPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.tabs.currency'));
  return <CurrencyTab />;
}
