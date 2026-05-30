import type { ReactElement } from 'react';

import {
  Banknote,
  Clock,
  FileText,
  Percent,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AccountingOnboardingCta } from '@/components/AccountingOnboardingCta';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { AccountingOverviewErrorState } from '@/pages/accounting/AccountingOverviewErrorState';
import { InvoicesOverdueAlert } from '@/pages/invoices/InvoicesOverdueAlert';
import {
  formatInvoiceAmount,
} from '@/pages/invoices/invoice-utils';
import { useInvoiceStats } from '@/pages/invoices/useInvoiceStats';

import { AccountingNativeStockSection } from './AccountingNativeStockSection';
import { AccountingRecentInvoicesCard } from './AccountingRecentInvoicesCard';
import { AccountingRevenueTrendChart } from './AccountingRevenueTrendChart';
import { useAccountingOverview } from './useAccountingOverview';

function formatKpiAmount(amount: string, currency: string): string {
  return formatInvoiceAmount(amount, currency);
}

interface KpiTileProps {
  title: string;
  count: number;
  amount: string;
  icon: typeof FileText;
  loading: boolean;
  accent?: 'blue' | 'green' | 'amber' | 'violet';
}

const ACCENT_STYLES: Record<NonNullable<KpiTileProps['accent']>, { icon: string; ring: string }> =
  {
    blue: {
      icon: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-blue-100 dark:ring-blue-900/60',
    },
    green: {
      icon: 'text-green-600 dark:text-green-400',
      ring: 'ring-green-100 dark:ring-green-900/50',
    },
    amber: {
      icon: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-100 dark:ring-amber-900/50',
    },
    violet: {
      icon: 'text-violet-600 dark:text-violet-400',
      ring: 'ring-violet-100 dark:ring-violet-900/50',
    },
  };

function KpiTile({
  title,
  count,
  amount,
  icon: Icon,
  loading,
  accent = 'blue',
}: KpiTileProps): ReactElement {
  const tones = ACCENT_STYLES[accent];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`rounded-full bg-background p-2 ring-2 ${tones.ring}`}>
          <Icon className={`h-4 w-4 ${tones.icon}`} aria-hidden />
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

export function AccountingOverviewPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const pageTitle = t('accounting.title');
  const navContextLine = formatNavPageContext(
    groupLabel,
    t('nav.accountingOverviewShort'),
  );

  usePageTitle(pageTitle);

  const { overview: overviewQuery, revenueTrend: revenueTrendQuery, recentInvoices } =
    useAccountingOverview({
      includeRevenueTrend: true,
      includeRecentInvoices: true,
    });
  const invoiceStatsQuery = useInvoiceStats();

  const overview = overviewQuery.data;
  const currency = overview?.currency ?? 'TRY';
  const recent = recentInvoices.data ?? [];
  const overviewLoading = overviewQuery.isLoading;
  const recentLoading = recentInvoices.isLoading;
  const overviewError = overviewQuery.isError;
  const revenueTrend = revenueTrendQuery.data;
  const revenueTrendCurrency = revenueTrend?.currency ?? currency;
  const showOnboarding =
    !overviewLoading &&
    !recentLoading &&
    !overviewError &&
    recent.length === 0 &&
    (overview?.openInvoiceCount ?? 0) === 0 &&
    (overview?.collectedCount ?? 0) === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description={t('accounting.subtitle')}
        context={navContextLine}
        actions={
          <Button variant="outline" asChild>
            <Link to="/invoices">
              <FileText className="mr-2 h-4 w-4" aria-hidden />
              {t('accounting.viewAllInvoices')}
            </Link>
          </Button>
        }
      />

      {overviewError ? (
        <AccountingOverviewErrorState
          error={overviewQuery.error}
          onRetry={() => {
            void overviewQuery.refetch();
          }}
        />
      ) : null}

      {showOnboarding ? <AccountingOnboardingCta variant="card" /> : null}

      {!invoiceStatsQuery.isLoading && (invoiceStatsQuery.data?.overdueCount ?? 0) > 0 ? (
        <InvoicesOverdueAlert count={invoiceStatsQuery.data?.overdueCount ?? 0} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          title={t('accounting.kpi.openReceivables')}
          count={overview?.customerCount ?? 0}
          amount={formatKpiAmount(overview?.openReceivablesAmount ?? '0', currency)}
          icon={Wallet}
          loading={overviewLoading}
          accent="blue"
        />
        <KpiTile
          title={t('accounting.kpi.pending')}
          count={overview?.openInvoiceCount ?? 0}
          amount={formatKpiAmount(overview?.openInvoiceTotal ?? '0', currency)}
          icon={Clock}
          loading={overviewLoading}
          accent="amber"
        />
        <KpiTile
          title={t('accounting.kpi.collectedThisMonth')}
          count={overview?.collectedCount ?? 0}
          amount={formatKpiAmount(overview?.collectedTotal ?? '0', currency)}
          icon={Banknote}
          loading={overviewLoading}
          accent="green"
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
          <CardContent className="divide-y divide-border pt-0">
            {overviewLoading ? (
              <div className="space-y-3 py-1">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted-foreground">{t('accounting.vatSubtotal')}</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatKpiAmount(overview?.vatSummary?.subtotal ?? '0', currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted-foreground">{t('accounting.vatTax')}</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatKpiAmount(overview?.vatSummary?.taxAmount ?? '0', currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted-foreground">{t('common.total')}</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatKpiAmount(overview?.vatSummary?.totalAmount ?? '0', currency)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AccountingNativeStockSection />

      <AccountingRevenueTrendChart
        points={revenueTrend?.points ?? []}
        currency={revenueTrendCurrency}
        loading={revenueTrendQuery.isLoading}
        errorMessage={
          revenueTrendQuery.isError ? getApiErrorMessage(revenueTrendQuery.error) : null
        }
        onRetry={
          revenueTrendQuery.isError
            ? () => {
                void revenueTrendQuery.refetch();
              }
            : undefined
        }
      />

      <AccountingRecentInvoicesCard query={recentInvoices} />
    </div>
  );
}
