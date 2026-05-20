import { LayoutGrid, PlugZap, ShoppingCart, TrendingUp, AlertTriangle, Trophy } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ActivityFeedWidget } from '@/components/widgets/ActivityFeedWidget';
import { ForecastCriticalWidget } from '@/components/widgets/ForecastCriticalWidget';
import { KpiWidget } from '@/components/widgets/KpiWidget';
import { LowStockWidget } from '@/components/widgets/LowStockWidget';
import { OrdersTrendWidget } from '@/components/widgets/OrdersTrendWidget';
import { PlatformDistributionWidget } from '@/components/widgets/PlatformDistributionWidget';
import { RecentOrdersWidget } from '@/components/widgets/RecentOrdersWidget';
import { RevenueChartWidget } from '@/components/widgets/RevenueChartWidget';
import { SyncStatusWidget } from '@/components/widgets/SyncStatusWidget';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import type { DashboardApiSummary } from '@/types/dashboard-widgets';
import type { WidgetType } from '@/types/dashboard-widgets';

import { DashboardCustomizeSheet } from './DashboardCustomizeSheet';
import { widgetGridClass } from './widget-meta';

type KpiPeriod = 'default' | '24h' | '7d' | 'month';

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('dashboard.title'));
  const navigate = useNavigate();
  const { socket } = useSocket();
  useDashboardRealtime();

  const [kpiPeriod, setKpiPeriod] = useState<KpiPeriod>('default');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { widgets, enabledTypes, saveWidgets } = useDashboardWidgets();

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', kpiPeriod],
    queryFn: async (): Promise<DashboardApiSummary> => {
      const { data } = await api.get<DashboardApiSummary>('/dashboard/summary', {
        params: { period: kpiPeriod },
      });
      return data;
    },
    staleTime: 60_000,
  });

  const dash = summaryQuery.data;
  const kpiLoading = summaryQuery.isPending;

  const ordersTitle =
    kpiPeriod === 'default'
      ? t('dashboard.ordersToday')
      : kpiPeriod === '24h'
        ? t('dashboard.orders24h')
        : kpiPeriod === '7d'
          ? t('dashboard.orders7d')
          : t('dashboard.ordersMonth');

  const ordersDeltaCaption =
    kpiPeriod === 'default' ? 'düne göre' : 'önceki döneme göre';

  useEffect(() => {
    if (!socket) {
      return undefined;
    }
    const onOrderNew = (data: unknown): void => {
      let description = 'Yeni sipariş alındı.';
      if (typeof data === 'object' && data !== null) {
        const d = data as Record<string, unknown>;
        const buyer = typeof d.buyerName === 'string' ? d.buyerName : 'Müşteri';
        const amt = d.totalAmount;
        const amountStr =
          typeof amt === 'string' || typeof amt === 'number'
            ? formatTry(Number(amt))
            : '—';
        description = `${buyer} · ${amountStr}`;
      }
      toast.success('Yeni sipariş', { description, duration: 5000 });
    };
    socket.on('order:new', onOrderNew);
    return (): void => {
      socket.off('order:new', onOrderNew);
    };
  }, [socket]);

  const renderWidget = (type: WidgetType): ReactElement | null => {
    switch (type) {
      case 'kpi_orders':
        return (
          <KpiWidget
            title={ordersTitle}
            value={dash?.todayOrders ?? '—'}
            change={dash?.todayOrdersDelta ?? 0}
            changeCaption={ordersDeltaCaption}
            icon={ShoppingCart}
            color="blue"
            loading={kpiLoading}
          />
        );
      case 'kpi_revenue':
        return (
          <KpiWidget
            title="Gelir"
            value={dash ? formatTry(dash.revenueTry) : '—'}
            change={dash?.revenueDeltaPct ?? 0}
            changeCaption={ordersDeltaCaption}
            icon={TrendingUp}
            color="green"
            loading={kpiLoading}
          />
        );
      case 'kpi_stock_alerts':
        return (
          <KpiWidget
            title={t('dashboard.lowStock')}
            value={dash?.lowStockCount ?? '—'}
            change={0}
            changeCaption="stok 1–5 arası"
            icon={AlertTriangle}
            color="yellow"
            href="/listings?stockTier=LOW"
            loading={kpiLoading}
          />
        );
      case 'kpi_buybox_rate':
        return (
          <KpiWidget
            title="BuyBox oranı"
            value={dash ? `${String(dash.buyboxWinRatePct)}%` : '—'}
            change={dash?.buyboxWinRateDeltaPct ?? 0}
            changeCaption="son 7 güne göre"
            icon={Trophy}
            color="purple"
            href="/pricing"
            loading={kpiLoading}
          />
        );
      case 'chart_orders':
        return <OrdersTrendWidget />;
      case 'chart_revenue':
        return <RevenueChartWidget />;
      case 'chart_platform':
        return <PlatformDistributionWidget />;
      case 'table_recent_orders':
        return <RecentOrdersWidget />;
      case 'table_low_stock':
        return <LowStockWidget />;
      case 'activity_feed':
        return <ActivityFeedWidget />;
      case 'sync_status':
        return <SyncStatusWidget />;
      case 'forecast_critical':
        return <ForecastCriticalWidget />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            {t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {(
              [
                { id: 'default' as const, label: 'Bugün' },
                { id: '24h' as const, label: '24s' },
                { id: '7d' as const, label: '7g' },
                { id: 'month' as const, label: 'Ay' },
              ] as const
            ).map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={kpiPeriod === p.id ? 'default' : 'outline'}
                onClick={() => {
                  setKpiPeriod(p.id);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setCustomizeOpen(true);
            }}
          >
            <LayoutGrid className="mr-1.5 h-4 w-4" aria-hidden />
            Düzenle
          </Button>
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 auto-rows-min">
        {widgets.map((widget) => (
          <div key={widget.id} className={widgetGridClass(widget.size)}>
            {renderWidget(widget.type)}
          </div>
        ))}
      </div>

      <DashboardCustomizeSheet
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        enabledTypes={enabledTypes}
        widgets={widgets}
        onSave={saveWidgets}
      />
    </div>
  );
}
