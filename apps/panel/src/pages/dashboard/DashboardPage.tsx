import { PlugZap } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AccountingOnboardingCta } from '@/components/AccountingOnboardingCta';
import { DashboardPeriodSelector } from '@/components/dashboard/DashboardPeriodSelector';
import { WidgetCustomizer } from '@/components/dashboard/WidgetCustomizer';
import { RecentOrdersWidget } from '@/components/widgets/RecentOrdersWidget';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardPeriodProvider } from '@/hooks/useDashboardPeriod';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import {
  appendBundleOptionalWidgets,
  getLayoutSectionsForOrg,
  mergeLayoutOrder,
} from '@/lib/dashboard-widget-registry';
import { isAccountingOnlyOrg, isBundleOrg } from '@/lib/org-products';
import { saveOfflineSnapshot } from '@/lib/offline-cache';
import { useAccountingOverview } from '@/pages/accounting/useAccountingOverview';
import { useAuthStore } from '@/store/auth.store';
import type { WidgetType } from '@/types/dashboard-widgets';

import { DashboardGrid } from './DashboardGrid';
import { DashboardKpiRow } from './DashboardKpiRow';
import { AccountingDashboardKpiWidget } from './widgets/AccountingDashboardKpiWidget';
import { AccountingRecentInvoicesWidget } from './widgets/AccountingRecentInvoicesWidget';
import { CriticalStockWidget } from './widgets/CriticalStockWidget';
import { PlatformBreakdownChart } from './widgets/PlatformBreakdownChart';
import { SalesTrendChart } from './widgets/SalesTrendChart';

function renderWidget(
  type: WidgetType,
  options: { accountingKpiCompact: boolean },
): ReactElement | null {
  switch (type) {
    case 'chart-sales':
      return <SalesTrendChart />;
    case 'table-orders':
      return <RecentOrdersWidget limit={5} variant="table" />;
    case 'chart-platforms':
      return <PlatformBreakdownChart />;
    case 'table-stock':
      return <CriticalStockWidget />;
    case 'accounting-kpi':
      return (
        <AccountingDashboardKpiWidget
          variant={options.accountingKpiCompact ? 'compact' : 'full'}
        />
      );
    case 'accounting-recent-invoices':
      return <AccountingRecentInvoicesWidget />;
    default:
      return null;
  }
}

function DashboardPageContent(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const accountingOnly = isAccountingOnlyOrg(orgProducts);
  const bundleOrg = isBundleOrg(orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const accountingKpiCompact = bundleOrg && !accountingOnly;

  const { overview: overviewQuery, recentInvoices } = useAccountingOverview({
    enabled: accountingOnly,
    includeRecentInvoices: accountingOnly,
  });
  const overview = overviewQuery.data;
  const showOnboarding =
    accountingOnly &&
    !overviewQuery.isLoading &&
    !recentInvoices.isLoading &&
    !overviewQuery.isError &&
    (recentInvoices.data ?? []).length === 0 &&
    (overview?.openInvoiceCount ?? 0) === 0 &&
    (overview?.collectedCount ?? 0) === 0;

  usePageTitle(accountingOnly ? t('accounting.title') : t('dashboard.title'));

  const { isVisible } = useDashboardWidgets();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { layout, setLayout } = useDashboardLayout();

  useDashboardRealtime();

  useEffect(() => {
    if (accountingOnly || !stats?.summary) {
      return;
    }
    saveOfflineSnapshot({
      ordersToday: stats.summary.todayOrders,
      revenueToday: stats.summary.revenueTry,
      pendingOrders: stats.summary.pendingOrders,
      lowStockCount: stats.summary.lowStockCount,
    });
  }, [accountingOnly, stats]);

  const { primary: primaryTypes, secondary: secondaryTypes, accounting: accountingTypes } =
    getLayoutSectionsForOrg(orgProducts, accountingMode);

  const filterVisible = (types: WidgetType[]): WidgetType[] =>
    types.filter((type) => accountingOnly || isVisible(type));

  const chartRow = filterVisible(
    mergeLayoutOrder(layout, primaryTypes, orgProducts, accountingMode),
  );
  const bottomRow = filterVisible(
    mergeLayoutOrder(layout, secondaryTypes, orgProducts, accountingMode),
  );
  const accountingRow = filterVisible(
    appendBundleOptionalWidgets(
      mergeLayoutOrder(layout, accountingTypes, orgProducts, accountingMode),
      orgProducts,
      isVisible,
    ),
  );

  const renderDashboardWidget = (type: WidgetType): ReactElement | null =>
    renderWidget(type, { accountingKpiCompact });

  const dash = stats?.summary;
  const showEmptyConnections =
    !accountingOnly && !statsLoading && dash && dash.totalConnections === 0;

  const allWidgetsHidden =
    !accountingOnly &&
    chartRow.length === 0 &&
    bottomRow.length === 0 &&
    accountingRow.length === 0;

  return (
    <div className="space-y-6">
      {!accountingOnly ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DashboardPeriodSelector />
          <WidgetCustomizer />
        </div>
      ) : null}

      {showOnboarding ? <AccountingOnboardingCta variant="card" /> : null}

      {!accountingOnly ? <DashboardKpiRow /> : null}

      {showEmptyConnections ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="pt-8 pb-8">
            <EmptyState
              iconNode={
                <PlugZap className="h-16 w-16 text-muted-foreground" aria-hidden />
              }
              title={t('dashboard.noConnectionsTitle')}
              description={t('dashboard.noConnectionsDesc')}
              actionSlot={
                <Button
                  type="button"
                  onClick={() => {
                    navigate('/connections');
                  }}
                >
                  {t('dashboard.addFirstConnection')}
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {allWidgetsHidden ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-8">
            <EmptyState
              title={t('dashboard.allWidgetsHiddenTitle')}
              description={t('dashboard.allWidgetsHiddenDesc')}
            />
          </CardContent>
        </Card>
      ) : null}

      <DashboardGrid
        layout={chartRow}
        gridClassName={
          accountingOnly
            ? 'grid grid-cols-1 gap-4'
            : 'grid grid-cols-1 gap-4 lg:grid-cols-3'
        }
        getItemClassName={(type) => {
          if (accountingOnly) {
            return '';
          }
          return type === 'chart-sales' ? 'lg:col-span-2' : 'lg:col-span-1';
        }}
        onReorder={(next) => {
          setLayout([...next, ...bottomRow, ...accountingRow]);
        }}
        renderWidget={renderDashboardWidget}
      />

      {bottomRow.length > 0 ? (
        <DashboardGrid
          layout={bottomRow}
          gridClassName={
            accountingOnly
              ? 'grid grid-cols-1 gap-4'
              : 'grid grid-cols-1 gap-4 lg:grid-cols-2'
          }
          onReorder={(next) => {
            setLayout([...chartRow, ...next, ...accountingRow]);
          }}
          renderWidget={renderDashboardWidget}
        />
      ) : null}

      {accountingRow.length > 0 ? (
        <DashboardGrid
          layout={accountingRow}
          gridClassName="grid grid-cols-1 gap-4 lg:grid-cols-2"
          onReorder={(next) => {
            setLayout([...chartRow, ...bottomRow, ...next]);
          }}
          renderWidget={renderDashboardWidget}
        />
      ) : null}
    </div>
  );
}

export function DashboardPage(): ReactElement {
  return (
    <DashboardPeriodProvider>
      <DashboardPageContent />
    </DashboardPeriodProvider>
  );
}
