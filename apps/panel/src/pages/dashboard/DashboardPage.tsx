import { PlugZap } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { DashboardPeriodSelector } from '@/components/dashboard/DashboardPeriodSelector';
import { WidgetCustomizer } from '@/components/dashboard/WidgetCustomizer';
import { LowStockWidget } from '@/components/widgets/LowStockWidget';
import { PlatformDistributionWidget } from '@/components/widgets/PlatformDistributionWidget';
import { RecentOrdersWidget } from '@/components/widgets/RecentOrdersWidget';
import { RevenueChartWidget } from '@/components/widgets/RevenueChartWidget';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DashboardPeriodProvider,
  useDashboardPeriod,
} from '@/hooks/useDashboardPeriod';
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api } from '@/lib/api';
import { saveOfflineSnapshot } from '@/lib/offline-cache';
import type { DashboardApiSummary } from '@/types/dashboard-widgets';
import type { WidgetType } from '@/types/dashboard-widgets';

import { DashboardKpiRow } from './DashboardKpiRow';
import { BuyboxRateWidget } from './widgets/BuyboxRateWidget';
import { SyncStatusWidget } from './widgets/SyncStatusWidget';
import { TopProductsWidget } from './widgets/TopProductsWidget';

const KPI_TYPES: WidgetType[] = [
  'kpi-revenue',
  'kpi-orders',
  'kpi-listings',
  'kpi-buybox',
];

function DashboardPageContent(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('dashboard.title'));
  const navigate = useNavigate();
  const { api: periodApi } = useDashboardPeriod();
  const { isVisible, isLoading: widgetsLoading } = useDashboardWidgets();

  useDashboardRealtime();

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', periodApi.queryKey],
    queryFn: async (): Promise<DashboardApiSummary> => {
      const { data } = await api.get<DashboardApiSummary>('/dashboard/summary', {
        params: { period: periodApi.summaryPeriod },
      });
      return data;
    },
    staleTime: 60_000,
  });

  const dash = summaryQuery.data;
  const kpiLoading = summaryQuery.isPending;

  useEffect(() => {
    if (!dash) {
      return;
    }
    saveOfflineSnapshot({
      ordersToday: dash.todayOrders,
      revenueToday: dash.revenueTry,
      pendingOrders: dash.pendingOrders,
      lowStockCount: dash.lowStockCount,
    });
  }, [dash]);

  const visibleKpis = KPI_TYPES.filter((type) => isVisible(type));

  const showRow2 =
    isVisible('revenue-chart') || isVisible('platform-breakdown');
  const showRow3 = isVisible('recent-orders') || isVisible('stock-alerts');
  const showRow4 =
    isVisible('top-products') ||
    isVisible('sync-status') ||
    isVisible('buybox-rate');

  if (widgetsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            {t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardPeriodSelector />
          <WidgetCustomizer />
        </div>
      </div>

      {visibleKpis.length > 0 ? (
        <DashboardKpiRow visibleKpis={visibleKpis} />
      ) : null}

      {!kpiLoading && dash && dash.totalConnections === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="pt-8 pb-8">
            <EmptyState
              iconNode={
                <PlugZap className="h-16 w-16 text-muted-foreground" aria-hidden />
              }
              title="Henüz bağlantı yok"
              description="Pazaryeri veya e-ticaret mağazanızı bağlayarak başlayın."
              actionSlot={
                <Button
                  type="button"
                  onClick={() => {
                    navigate('/connections');
                  }}
                >
                  İlk Bağlantıyı Ekle
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {showRow2 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {isVisible('revenue-chart') ? (
            <div className="lg:col-span-8">
              <RevenueChartWidget />
            </div>
          ) : null}
          {isVisible('platform-breakdown') ? (
            <div className="lg:col-span-4">
              <PlatformDistributionWidget />
            </div>
          ) : null}
        </div>
      ) : null}

      {showRow3 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {isVisible('recent-orders') ? (
            <div className="lg:col-span-8">
              <RecentOrdersWidget limit={10} variant="table" />
            </div>
          ) : null}
          {isVisible('stock-alerts') ? (
            <div className="lg:col-span-4">
              <LowStockWidget showChart={false} limit={8} />
            </div>
          ) : null}
        </div>
      ) : null}

      {showRow4 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {isVisible('top-products') ? (
            <div className="lg:col-span-6">
              <TopProductsWidget />
            </div>
          ) : null}
          {isVisible('sync-status') ? (
            <div className="lg:col-span-6">
              <SyncStatusWidget />
            </div>
          ) : null}
        </div>
      ) : null}

      {isVisible('buybox-rate') ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <BuyboxRateWidget />
          </div>
        </div>
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
