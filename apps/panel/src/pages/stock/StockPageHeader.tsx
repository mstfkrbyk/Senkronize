import type { ReactElement, ReactNode } from 'react';

import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useActiveNav } from '@/hooks/useActiveNav';
import { formatStockNavContext } from '@/pages/stock/stock-nav-context';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

export interface StockPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Detay sayfası üçüncü segmenti (ör. transfer no). */
  leafLabel?: string;
}

export function StockPageHeader({
  title,
  description,
  actions,
  className,
  leafLabel,
}: StockPageHeaderProps): ReactElement {
  const { t } = useTranslation();
  const { groupLabel, pageLabel } = useActiveNav();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const contextLine = formatStockNavContext(
    groupLabel,
    pageLabel ?? t('nav.stock'),
    orgProducts,
    accountingMode,
    t,
    leafLabel,
  );

  return (
    <PageHeader
      className={className}
      title={title}
      description={description}
      actions={actions}
      context={contextLine}
    />
  );
}

export function StockNavContextLine({
  className,
  leafLabel,
}: {
  className?: string;
  leafLabel?: string;
}): ReactElement {
  const { t } = useTranslation();
  const { groupLabel, pageLabel } = useActiveNav();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const contextLine = formatStockNavContext(
    groupLabel,
    pageLabel ?? t('nav.stock'),
    orgProducts,
    accountingMode,
    t,
    leafLabel,
  );

  return (
    <p className={cn('text-muted-foreground text-sm', className)}>{contextLine}</p>
  );
}
