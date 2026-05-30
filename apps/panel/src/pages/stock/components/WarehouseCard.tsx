import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Warehouse } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { StockOverviewRow, WarehouseDto } from '@/types/stock';

import { parseAccountingInventoryTotalValue } from '../accounting-inventory-valuation.types';
import {
  useInventoryValuation,
  useNativeInventoryValuationEnabled,
} from '../hooks/useInventoryValuation';

function warehouseStats(
  rows: StockOverviewRow[],
  warehouseId: string,
  costMap: Map<string, number>,
): { skuCount: number; totalValue: number } {
  let skuCount = 0;
  let totalValue = 0;
  for (const row of rows) {
    const wh = row.byWarehouse.find((w) => w.warehouseId === warehouseId);
    if (!wh || wh.quantity <= 0) {
      continue;
    }
    skuCount += 1;
    totalValue += wh.quantity * (costMap.get(row.barcode) ?? 0);
  }
  return { skuCount, totalValue };
}

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface Props {
  warehouse: WarehouseDto;
  overview: StockOverviewRow[];
  costMap: Map<string, number>;
  onEdit: (warehouse: WarehouseDto) => void;
  onDelete: (warehouseId: string) => void;
  deletePending: boolean;
}

export function WarehouseCard({
  warehouse: w,
  overview,
  costMap,
  onEdit,
  onDelete,
  deletePending,
}: Props): ReactElement {
  const { t } = useTranslation();
  const { enabled: useNativeValuation } = useNativeInventoryValuationEnabled();
  const valuationQuery = useInventoryValuation({ warehouseId: w.id });

  const fallbackStats = useMemo(
    () => warehouseStats(overview, w.id, costMap),
    [overview, w.id, costMap],
  );

  const skuCount = useNativeValuation
    ? (valuationQuery.data?.skuCount ?? 0)
    : fallbackStats.skuCount;

  const totalValue = useNativeValuation
    ? parseAccountingInventoryTotalValue(valuationQuery.data?.totalValue)
    : fallbackStats.totalValue;

  const statsLoading = useNativeValuation && valuationQuery.isLoading;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Warehouse className="size-4 text-sky-500" aria-hidden />
            {w.name}
          </CardTitle>
          {w.isDefault ? (
            <Badge className="shrink-0 bg-sky-500 text-white hover:bg-sky-500">
              {t('stock.warehouses.default')}
            </Badge>
          ) : null}
        </div>
        <CardDescription className="font-mono text-xs">{w.code}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          {w.address ?? t('stock.warehouses.noAddress')}
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            {t('stock.warehouses.totalSku')}:{' '}
            {statsLoading ? (
              <Skeleton className="inline-block h-4 w-10 align-middle" />
            ) : (
              <strong className="text-foreground tabular-nums">
                {skuCount.toLocaleString('tr-TR')}
              </strong>
            )}
          </span>
          <span>
            {t('stock.warehouses.totalValue')}:{' '}
            {statsLoading ? (
              <Skeleton className="inline-block h-4 w-16 align-middle" />
            ) : (
              <strong className="text-foreground tabular-nums">
                {totalValue > 0 ? formatTry(totalValue) : '—'}
              </strong>
            )}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onEdit(w)}>
            <Pencil className="mr-1 size-3.5" />
            {t('common.edit')}
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to={`/products?tab=status&warehouse=${w.id}`}>
              {t('stock.warehouses.stockList')}
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={deletePending || w.isDefault}
            onClick={() => onDelete(w.id)}
          >
            <Trash2 className="mr-1 size-3.5" />
            {t('common.delete')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
