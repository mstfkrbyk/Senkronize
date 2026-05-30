import { Banknote, Clock, Percent } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountingOverviewErrorState } from '@/pages/accounting/AccountingOverviewErrorState';
import {
  formatInvoiceAmount,
} from '@/pages/invoices/invoice-utils';
import { useAccountingOverview } from '@/pages/accounting/useAccountingOverview';

function KpiTile({
  title,
  count,
  amount,
  icon: Icon,
  loading,
  accentClass,
  ringClass,
}: {
  title: string;
  count: number;
  amount: string;
  icon: typeof Clock;
  loading: boolean;
  accentClass: string;
  ringClass: string;
}): ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`rounded-full bg-background p-2 ring-2 ${ringClass}`}>
          <Icon className={`h-4 w-4 ${accentClass}`} aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-5 w-28" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums text-foreground">{count}</p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">{amount}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface Props {
  /** BUNDLE dashboard: yalnızca bekleyen + tahsilat KPI (VAT kartı yok). */
  variant?: 'full' | 'compact';
}

export function AccountingDashboardKpiWidget({
  variant = 'full',
}: Props): ReactElement {
  const { t } = useTranslation();

  const { overview: overviewQuery } = useAccountingOverview();

  const overview = overviewQuery.data;
  const currency = overview?.currency ?? 'TRY';
  const loading = overviewQuery.isLoading;

  if (overviewQuery.isError) {
    return (
      <AccountingOverviewErrorState
        error={overviewQuery.error}
        variant="compact"
        onRetry={() => {
          void overviewQuery.refetch();
        }}
      />
    );
  }

  if (variant === 'compact') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiTile
          title={t('accounting.kpi.pending')}
          count={overview?.openInvoiceCount ?? 0}
          amount={formatInvoiceAmount(overview?.openInvoiceTotal ?? '0', currency)}
          icon={Clock}
          loading={loading}
          accentClass="text-amber-600 dark:text-amber-400"
          ringClass="ring-amber-100 dark:ring-amber-900/50"
        />
        <KpiTile
          title={t('accounting.kpi.collectedThisMonth')}
          count={overview?.collectedCount ?? 0}
          amount={formatInvoiceAmount(overview?.collectedTotal ?? '0', currency)}
          icon={Banknote}
          loading={loading}
          accentClass="text-green-600 dark:text-green-400"
          ringClass="ring-green-100 dark:ring-green-900/50"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <KpiTile
        title={t('accounting.kpi.pending')}
        count={overview?.openInvoiceCount ?? 0}
        amount={formatInvoiceAmount(overview?.openInvoiceTotal ?? '0', currency)}
        icon={Clock}
        loading={loading}
        accentClass="text-amber-600 dark:text-amber-400"
        ringClass="ring-amber-100 dark:ring-amber-900/50"
      />
      <KpiTile
        title={t('accounting.kpi.collectedThisMonth')}
        count={overview?.collectedCount ?? 0}
        amount={formatInvoiceAmount(overview?.collectedTotal ?? '0', currency)}
        icon={Banknote}
        loading={loading}
        accentClass="text-green-600 dark:text-green-400"
        ringClass="ring-green-100 dark:ring-green-900/50"
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('accounting.kpi.vatSummary')}
          </CardTitle>
          <div className="rounded-full bg-background p-2 ring-2 ring-violet-100 dark:ring-violet-900/50">
            <Percent
              className="h-4 w-4 text-violet-600 dark:text-violet-400"
              aria-hidden
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('accounting.vatSubtotal')}</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatInvoiceAmount(overview?.vatSummary?.subtotal ?? '0', currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('accounting.vatTax')}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatInvoiceAmount(overview?.vatSummary?.taxAmount ?? '0', currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('common.total')}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatInvoiceAmount(overview?.vatSummary?.totalAmount ?? '0', currency)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
