import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ProductMatchingSettingsTab } from './tabs/ProductMatchingSettingsTab';

export function ProductMatchingSettingsPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.tabs.productMatching'));
  return <ProductMatchingSettingsTab />;
}
