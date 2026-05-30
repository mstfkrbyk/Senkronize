import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@/hooks/usePageTitle';
import { InvoiceNumberingTab } from './tabs/InvoiceNumberingTab';

export function InvoiceNumberingSettingsPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.tabs.invoiceNumbering'));
  return <InvoiceNumberingTab />;
}
