import type { ReactElement } from 'react';
import { FileText, LayoutGrid, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

/** Entegrasyon tablo sayfalarında yalnızca ön muhasebe paketi için boş durum. */
export function IntegrationTableAccountingEmptyState(): ReactElement {
  const { t } = useTranslation();

  return (
    <EmptyState
      iconNode={
        <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50">
          <LayoutGrid className="h-7 w-7 text-emerald-700" aria-hidden />
        </span>
      }
      title={t('emptyState.accounting.tableNoIntegrationTitle')}
      description={t('emptyState.accounting.tableNoIntegrationDescription')}
      actionSlot={
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <p className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-left text-sm text-emerald-950">
            <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            <span>{t('emptyState.accounting.tableNoIntegrationHint')}</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" variant="default" size="sm" asChild>
              <Link to="/invoices">
                <FileText className="mr-2 h-4 w-4" aria-hidden />
                {t('emptyState.accounting.goToInvoices')}
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/accounting">{t('emptyState.accounting.goToAccounting')}</Link>
            </Button>
          </div>
        </div>
      }
    />
  );
}
