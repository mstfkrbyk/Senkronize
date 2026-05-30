import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AccountingModeTab } from './tabs/AccountingModeTab';

export function AccountingModeSettingsPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.tabs.accountingMode'));
  return <AccountingModeTab />;
}
