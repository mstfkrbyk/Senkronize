import { AlertTriangle, Package, ShoppingCart, TrendingUp } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { KpiCard } from '@/components/widgets/KpiCard';
import { useDashboardPeriod } from '@/hooks/useDashboardPeriod';
import { useDashboardStats } from '@/hooks/useDashboardStats';

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardKpiRow(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { api: periodApi } = useDashboardPeriod();
  const { data, isLoading } = useDashboardStats();

  const dash = data?.summary;
  const kpis = data?.kpis;

  const ordersValue =
    periodApi.summaryPeriod === 'month'
      ? (dash?.windowOrders ?? kpis?.orders.current ?? 0)
      : (kpis?.orders.current ?? dash?.todayOrders ?? 0);

  const ordersChange =
    periodApi.summaryPeriod === 'month'
      ? (dash?.windowOrdersDeltaPct ?? kpis?.orders.change ?? 0)
      : (kpis?.orders.change ?? dash?.todayOrdersDelta ?? 0);

  const changeLabel =
    periodApi.summaryPeriod === 'month'
      ? t('dashboard.changeVsLastMonth')
      : t('dashboard.changeVsLastWeek');

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title={t('dashboard.totalOrders')}
        value={ordersValue}
        change={ordersChange}
        changeLabel={changeLabel}
        icon={ShoppingCart}
        color="blue"
        loading={isLoading}
        onClick={() => {
          navigate('/orders');
        }}
      />
      <KpiCard
        title={t('dashboard.totalRevenue')}
        value={formatTry(dash?.revenueTry ?? kpis?.revenue.current ?? 0)}
        change={dash?.revenueDeltaPct ?? kpis?.revenue.change ?? 0}
        changeLabel={changeLabel}
        icon={TrendingUp}
        color="green"
        loading={isLoading}
      />
      <KpiCard
        title={t('dashboard.activeProducts')}
        value={kpis?.activeListings.current ?? 0}
        change={kpis?.activeListings.change ?? 0}
        changeLabel={changeLabel}
        icon={Package}
        color="yellow"
        loading={isLoading}
        onClick={() => {
          navigate('/listings');
        }}
      />
      <KpiCard
        title={t('dashboard.stockAlerts')}
        value={dash?.lowStockCount ?? kpis?.lowStockProducts ?? 0}
        icon={AlertTriangle}
        color="red"
        loading={isLoading}
        onClick={() => {
          navigate('/listings?stockTier=LOW');
        }}
      />
    </div>
  );
}
