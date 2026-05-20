import { useMemo } from 'react';

import { useStockOverview } from './useStockManagement';
import { getStockLevelStatus } from '../stock-status';
import { useProductMetaMap } from './useProductMetaMap';

export interface StockKpiMetrics {
  totalSkuCount: number;
  criticalCount: number;
  outOfStockCount: number;
  reservedStock: number;
}

export function useStockKpis(): {
  metrics: StockKpiMetrics;
  loading: boolean;
} {
  const overviewQuery = useStockOverview();
  const metaMapQuery = useProductMetaMap();

  const metrics = useMemo((): StockKpiMetrics => {
    const overview = overviewQuery.data ?? [];
    const metaMap = metaMapQuery.data ?? new Map();

    let criticalCount = 0;
    let outOfStockCount = 0;
    let reservedStock = 0;

    for (const row of overview) {
      reservedStock += row.totalReserved;
      const meta = metaMap.get(row.barcode);
      const status = getStockLevelStatus(
        row.available,
        meta?.reorderPoint,
        row.lowStock,
      );
      if (status === 'OUT') {
        outOfStockCount += 1;
      } else if (status === 'CRITICAL' || status === 'LOW') {
        criticalCount += 1;
      }
    }

    return {
      totalSkuCount: overview.length,
      criticalCount,
      outOfStockCount,
      reservedStock,
    };
  }, [overviewQuery.data, metaMapQuery.data]);

  const loading = overviewQuery.isLoading || metaMapQuery.isLoading;

  return { metrics, loading };
}
