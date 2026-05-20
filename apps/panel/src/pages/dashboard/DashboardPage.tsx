import { PlugZap } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { DashboardPeriodSelector } from '@/components/dashboard/DashboardPeriodSelector';
import { WidgetCustomizer } from '@/components/dashboard/WidgetCustomizer';
import { RecentOrdersWidget } from '@/components/widgets/RecentOrdersWidget';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardPeriodProvider } from '@/hooks/useDashboardPeriod';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import { usePageTitle } from '@/hooks/usePageTitle';
import { saveOfflineSnapshot } from '@/lib/offline-cache';
import type { WidgetType } from '@/types/dashboard-widgets';

import { DashboardGrid } from './DashboardGrid';
import { DashboardKpiRow } from './DashboardKpiRow';
import { CriticalStockWidget } from './widgets/CriticalStockWidget';
import { PlatformBreakdownChart } from './widgets/PlatformBreakdownChart';
import { SalesTrendChart } from './widgets/SalesTrendChart';

const CHART_ROW_TYPES: WidgetType[] = ['chart-sales', 'table-orders'];
const BOTTOM_ROW_TYPES: WidgetType[] = ['chart-platforms', 'table-stock'];

function mergeLayoutOrder(
  stored: WidgetType[],
  defaults: WidgetType[],
): WidgetType[] {
  const ordered = stored.filter((type) => defaults.includes(type));
  for (const type of defaults) {
    if (!ordered.includes(type)) {
      ordered.push(type);
    }
  }
  return ordered;
}

function renderWidget(type: WidgetType): ReactElement | null {
  switch (type) {
    case 'chart-sales':
      return <SalesTrendChart />;
    case 'table-orders':
      return <RecentOrdersWidget limit={5} variant="table" />;
    case 'chart-platforms':
      return <PlatformBreakdownChart />;
    case 'table-stock':
      return <CriticalStockWidget />;
    default:
      return null;
  }
}

function DashboardPageContent(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('dashboard.title'));
  const navigate = useNavigate();
  const { isLoading: widgetsLoading } = useDashboardWidgets();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { layout, setLayout } = useDashboardLayout();

  useDashboardRealtime();

  useEffect(() => {
    if (!stats?.summary) {
      return;
    }
    saveOfflineSnapshot({
      ordersToday: stats.summary.todayOrders,
      revenueToday: stats.summary.revenueTry,
      pendingOrders: stats.summary.pendingOrders,
      lowStockCount: stats.summary.lowStockCount,
    });
  }, [stats]);

  const chartRow = mergeLayoutOrder(layout, CHART_ROW_TYPES);
  const bottomRow = mergeLayoutOrder(layout, BOTTOM_ROW_TYPES);

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

  const dash = stats?.summary;
  const showEmptyConnections =
    !statsLoading && dash && dash.totalConnections === 0;

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

      <DashboardKpiRow />

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

      <DashboardGrid
        layout={chartRow}
        gridClassName="grid grid-cols-1 gap-4 lg:grid-cols-3"
        getItemClassName={(type) =>
          type === 'chart-sales' ? 'lg:col-span-2' : 'lg:col-span-1'
        }
        onReorder={(next) => {
          setLayout([...next, ...bottomRow]);
        }}
        renderWidget={renderWidget}
      />

      <DashboardGrid
        layout={bottomRow}
        gridClassName="grid grid-cols-1 gap-4 lg:grid-cols-2"
        onReorder={(next) => {
          setLayout([...chartRow, ...next]);
        }}
        renderWidget={renderWidget}
      />
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
