import type { ReactElement } from 'react';

import { AccountingRecentInvoicesCard } from '@/pages/accounting/AccountingRecentInvoicesCard';
import { useAccountingOverview } from '@/pages/accounting/useAccountingOverview';

export function AccountingRecentInvoicesWidget(): ReactElement {
  const { recentInvoices } = useAccountingOverview({ includeRecentInvoices: true });

  return <AccountingRecentInvoicesCard query={recentInvoices} />;
}
