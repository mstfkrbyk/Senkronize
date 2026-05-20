import { LayoutGrid, PlugZap, Plus, RotateCcw, Save } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { LowStockWidget } from '@/components/widgets/LowStockWidget';
import { PlatformDistributionWidget } from '@/components/widgets/PlatformDistributionWidget';
import { RecentOrdersWidget } from '@/components/widgets/RecentOrdersWidget';
import { RevenueChartWidget } from '@/components/widgets/RevenueChartWidget';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import { saveOfflineSnapshot } from '@/lib/offline-cache';
import type { DashboardApiSummary } from '@/types/dashboard-widgets';
import type { WidgetType } from '@/types/dashboard-widgets';

import { DashboardAddWidgetDialog } from './DashboardAddWidgetDialog';
import { DashboardKpiRow } from './DashboardKpiRow';
import { DashboardWidgetGrid } from './DashboardWidgetGrid';
import { ALL_WIDGET_TYPES } from './widget-meta';
import { BuyboxRateWidget } from './widgets/BuyboxRateWidget';
import { OrdersSummaryWidget } from './widgets/OrdersSummaryWidget';
import { SyncStatusWidget } from './widgets/SyncStatusWidget';
import { TopProductsWidget } from './widgets/TopProductsWidget';

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

  const [editMode, setEditMode] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const {
    widgets: savedWidgets,
    saveWidgets,
    resetToDefault,
    removeWidget,
    addWidget,
  } = useDashboardWidgets();

  const [draftWidgets, setDraftWidgets] = useState(savedWidgets);

  useEffect(() => {
    if (!editMode) {
      setDraftWidgets(savedWidgets);
    }
  }, [editMode, savedWidgets]);

  const displayWidgets = editMode ? draftWidgets : savedWidgets;

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', 'default'],
    queryFn: async (): Promise<DashboardApiSummary> => {
      const { data } = await api.get<DashboardApiSummary>('/dashboard/summary', {
        params: { period: 'default' },
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
    socket.on('order:created', onOrderNew);
    return (): void => {
      socket.off('order:new', onOrderNew);
      socket.off('order:created', onOrderNew);
    };
  }, [socket]);

  const availableToAdd = useMemo(() => {
    const enabled = new Set(displayWidgets.map((w) => w.type));
    return ALL_WIDGET_TYPES.filter((type) => !enabled.has(type));
  }, [displayWidgets]);

  const renderWidget = (type: WidgetType): ReactElement | null => {
    switch (type) {
      case 'revenue-chart':
        return <RevenueChartWidget />;
      case 'orders-summary':
        return <OrdersSummaryWidget />;
      case 'platform-breakdown':
        return <PlatformDistributionWidget />;
      case 'stock-alerts':
        return <LowStockWidget />;
      case 'sync-status':
        return <SyncStatusWidget />;
      case 'top-products':
        return <TopProductsWidget />;
      case 'recent-orders':
        return <RecentOrdersWidget />;
      case 'buybox-rate':
        return <BuyboxRateWidget />;
      default:
        return null;
    }
  };

  const handleSaveLayout = (): void => {
    saveWidgets(draftWidgets);
    setEditMode(false);
    toast.success('Dashboard düzeni kaydedildi.');
  };

  const handleResetDefault = (): void => {
    const defaults = resetToDefault();
    setDraftWidgets(defaults);
    if (!editMode) {
      saveWidgets(defaults);
      toast.success('Varsayılan düzen yüklendi.');
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
          {editMode ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setAddDialogOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                Widget Ekle
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleResetDefault}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                Varsayılana Döndür
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={handleSaveLayout}
              >
                <Save className="mr-1.5 h-4 w-4" aria-hidden />
                Kaydet
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraftWidgets(savedWidgets);
                  setEditMode(false);
                }}
              >
                İptal
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDraftWidgets(savedWidgets);
                setEditMode(true);
              }}
            >
              <LayoutGrid className="mr-1.5 h-4 w-4" aria-hidden />
              Düzenle
            </Button>
          )}
        </div>
      </div>

      <DashboardKpiRow dash={dash} loading={kpiLoading} />

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

      <DashboardWidgetGrid
        widgets={displayWidgets}
        editMode={editMode}
        onReorder={setDraftWidgets}
        onRemove={(type) => {
          setDraftWidgets((prev) => removeWidget(prev, type));
        }}
        renderWidget={renderWidget}
      />

      <DashboardAddWidgetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        availableTypes={availableToAdd}
        onAdd={(type) => {
          setDraftWidgets((prev) => addWidget(prev, type));
        }}
      />
    </div>
  );
}
