import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { StockOverviewRow } from '@/types/stock';
import type { StockoutEstimateDto } from '@/types/stock-forecast';

import { useProductCostMap } from './useProductCostMap';
import {
  useDailyMovementFlow,
  useStockOverview,
} from './useStockManagement';

export interface StockKpiMetrics {
  totalValueTry: number;
  criticalCount: number;
  movementVolume7d: number;
  avgTurnoverRate: number;
}

function computeTotalValue(
  rows: StockOverviewRow[],
  costMap: Map<string, number>,
): number {
  let total = 0;
  for (const row of rows) {
    const cost = costMap.get(row.barcode) ?? 0;
    total += row.totalQuantity * cost;
  }
  return total;
}

function countCritical(rows: StockoutEstimateDto[]): number {
  return rows.filter((r) => {
    if (r.currentStock <= 0) {
      return true;
    }
    if (r.belowReorder) {
      return true;
    }
    return (
      r.daysUntilStockout !== null &&
      Number.isFinite(r.daysUntilStockout) &&
      r.daysUntilStockout < 7
    );
  }).length;
}

export function useStockKpis(): {
  metrics: StockKpiMetrics;
  loading: boolean;
} {
  const overviewQuery = useStockOverview();
  const costMapQuery = useProductCostMap();
  const flowQuery = useDailyMovementFlow(7);

  const forecastQuery = useQuery({
    queryKey: ['stock-forecast', 'bulk'],
    queryFn: async (): Promise<StockoutEstimateDto[]> => {
      const { data } = await api.get<{ data: StockoutEstimateDto[] }>(
        '/stock/forecast',
      );
      return data.data;
    },
  });

  const metrics = useMemo((): StockKpiMetrics => {
    const overview = overviewQuery.data ?? [];
    const costMap = costMapQuery.data ?? new Map<string, number>();
    const flow = flowQuery.data ?? [];
    const forecast = forecastQuery.data ?? [];

    let movementVolume7d = 0;
    let outflow7d = 0;
    for (const point of flow) {
      movementVolume7d += point.inflow + point.outflow;
      outflow7d += point.outflow;
    }

    const totalUnits = overview.reduce((s, r) => s + r.totalQuantity, 0);
    const avgTurnoverRate =
      totalUnits > 0 ? Math.round((outflow7d / totalUnits) * 100) / 100 : 0;

    return {
      totalValueTry: computeTotalValue(overview, costMap),
      criticalCount: countCritical(forecast),
      movementVolume7d,
      avgTurnoverRate,
    };
  }, [
    overviewQuery.data,
    costMapQuery.data,
    flowQuery.data,
    forecastQuery.data,
  ]);

  const loading =
    overviewQuery.isLoading ||
    costMapQuery.isLoading ||
    flowQuery.isLoading ||
    forecastQuery.isLoading;

  return { metrics, loading };
}
