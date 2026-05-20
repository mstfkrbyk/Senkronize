import { Package, ShoppingCart, TrendingUp, Trophy } from 'lucide-react';
import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';

import { AnimatedKpiCard } from '@/components/dashboard/AnimatedKpiCard';
import { useDashboardPeriod } from '@/hooks/useDashboardPeriod';
import { api } from '@/lib/api';
import type {
  DashboardApiSummary,
  DashboardKpisResponse,
} from '@/types/dashboard-widgets';
import type { WidgetType } from '@/types/dashboard-widgets';

interface Props {
  visibleKpis: WidgetType[];
}

export function DashboardKpiRow({ visibleKpis }: Props): ReactElement | null {
  const { api: periodApi } = useDashboardPeriod();

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

  const kpisQuery = useQuery({
    queryKey: ['dashboard', 'kpis', periodApi.queryKey],
    queryFn: async (): Promise<DashboardKpisResponse> => {
      const { data } = await api.get<DashboardKpisResponse>('/dashboard/kpis', {
        params: { period: periodApi.kpiPeriod },
      });
      return data;
    },
    staleTime: 60_000,
  });

  const loading = summaryQuery.isPending || kpisQuery.isPending;
  const dash = summaryQuery.data;
  const kpis = kpisQuery.data;

  const kpiSet = new Set(visibleKpis);
  const cards: ReactElement[] = [];

  if (kpiSet.has('kpi-revenue')) {
    cards.push(
      <AnimatedKpiCard
        key="kpi-revenue"
        title="Bugünkü gelir"
        numericValue={dash?.revenueTry ?? 0}
        format="currency"
        change={dash?.revenueDeltaPct ?? 0}
        changeCaption="düne göre"
        icon={TrendingUp}
        color="green"
        loading={loading}
      />,
    );
  }

  if (kpiSet.has('kpi-orders')) {
    const ordersValue =
      periodApi.summaryPeriod === 'month'
        ? (dash?.windowOrders ?? kpis?.orders.current ?? 0)
        : (kpis?.orders.current ?? dash?.todayOrders ?? 0);
    const ordersChange =
      periodApi.summaryPeriod === 'month'
        ? (dash?.windowOrdersDeltaPct ?? kpis?.orders.change ?? 0)
        : (kpis?.orders.change ?? dash?.todayOrdersDelta ?? 0);

    cards.push(
      <AnimatedKpiCard
        key="kpi-orders"
        title="Toplam sipariş"
        numericValue={ordersValue}
        format="integer"
        change={ordersChange}
        changeCaption={
          periodApi.summaryPeriod === 'month' ? 'geçen aya göre' : 'önceki döneme göre'
        }
        icon={ShoppingCart}
        color="blue"
        href="/orders"
        loading={loading}
      />,
    );
  }

  if (kpiSet.has('kpi-listings')) {
    cards.push(
      <AnimatedKpiCard
        key="kpi-listings"
        title="Aktif listeleme"
        numericValue={kpis?.activeListings.current ?? 0}
        format="integer"
        change={kpis?.activeListings.change ?? 0}
        changeCaption="önceki döneme göre"
        icon={Package}
        color="yellow"
        href="/listings"
        loading={loading}
      />,
    );
  }

  if (kpiSet.has('kpi-buybox')) {
    cards.push(
      <AnimatedKpiCard
        key="kpi-buybox"
        title="BuyBox kazanma oranı"
        numericValue={dash?.buyboxWinRatePct ?? kpis?.buyboxWinRate ?? 0}
        format="percent"
        change={dash?.buyboxWinRateDeltaPct ?? 0}
        changeCaption="önceki döneme göre"
        icon={Trophy}
        color="purple"
        href="/pricing"
        loading={loading}
      />,
    );
  }

  if (cards.length === 0) {
    return null;
  }

  return (
    <div
      className={`grid gap-4 ${
        cards.length === 1
          ? 'grid-cols-1'
          : cards.length === 2
            ? 'grid-cols-2'
            : cards.length === 3
              ? 'grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-2 lg:grid-cols-4'
      }`}
    >
      {cards}
    </div>
  );
}
