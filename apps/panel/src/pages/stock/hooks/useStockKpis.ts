import { useMemo } from 'react';

import { getApiErrorMessage } from '@/lib/api';

import { useStockOverview } from './useStockManagement';
import { getStockLevelStatus } from '../stock-status';
import { useProductMetaMap } from './useProductMetaMap';
import { parseAccountingInventoryTotalValue } from '../accounting-inventory-valuation.types';
import {
  useInventoryValuation,
  useNativeInventoryValuationEnabled,
} from './useInventoryValuation';

export interface StockKpiMetrics {
  totalSkuCount: number;
  criticalCount: number;
  outOfStockCount: number;
  reservedStock: number;
  showTotalStockValue: boolean;
  totalStockValue: number;
}

export function useStockKpis(enabled = true): {
  metrics: StockKpiMetrics;
  loading: boolean;
  errorMessage?: string;
} {
  const { enabled: showNativeStockValue, isLoading: accountingModeLoading } =
    useNativeInventoryValuationEnabled();

  const overviewQuery = useStockOverview({ enabled });
  const metaMapQuery = useProductMetaMap(enabled);
  const valuationQuery = useInventoryValuation({ enabled: enabled && showNativeStockValue });

  const totalStockValue = useMemo(
    () => parseAccountingInventoryTotalValue(valuationQuery.data?.totalValue),
    [valuationQuery.data?.totalValue],
  );

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
      showTotalStockValue: showNativeStockValue,
      totalStockValue,
    };
  }, [
    overviewQuery.data,
    metaMapQuery.data,
    showNativeStockValue,
    totalStockValue,
  ]);

  const loading =
    overviewQuery.isLoading ||
    metaMapQuery.isLoading ||
    (showNativeStockValue &&
      (accountingModeLoading || valuationQuery.isLoading));

  const errorMessage = useMemo((): string | undefined => {
    if (overviewQuery.isError) {
      return getApiErrorMessage(overviewQuery.error);
    }
    if (showNativeStockValue && valuationQuery.isError) {
      return getApiErrorMessage(valuationQuery.error);
    }
    return undefined;
  }, [
    overviewQuery.isError,
    overviewQuery.error,
    showNativeStockValue,
    valuationQuery.isError,
    valuationQuery.error,
  ]);

  return { metrics, loading, errorMessage };
}
