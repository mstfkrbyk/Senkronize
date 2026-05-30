import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';
import type { WarehouseDto } from '@/types/stock';

import {
  useAdjustStock,
  useStockOverview,
  useWarehouses,
} from '../hooks/useStockManagement';
import { useProductMetaMap } from '../hooks/useProductMetaMap';
import {
  getStockLevelStatus,
  STOCK_LEVEL_LABELS,
  stockLevelBadgeClass,
  type StockLevelStatus,
} from '../stock-status';

interface FlatStockRow {
  key: string;
  barcode: string;
  productName: string;
  sku: string | null;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reserved: number;
  net: number;
  reorderPoint: number | null;
  status: StockLevelStatus;
  productId: string | null;
}

function rowBackgroundClass(status: StockLevelStatus): string {
  if (status === 'OUT') {
    return 'bg-red-50/80 dark:bg-red-950/30';
  }
  if (status === 'CRITICAL' || status === 'LOW') {
    return 'bg-amber-50/70 dark:bg-amber-950/25';
  }
  return '';
}

interface InlineQtyProps {
  barcode: string;
  productName: string;
  quantity: number;
}

function InlineStockQty({
  barcode,
  productName,
  quantity,
}: InlineQtyProps): ReactElement {
  const { t } = useTranslation();
  const adjust = useAdjustStock();
  const [value, setValue] = useState(String(quantity));

  const commit = (): void => {
    const next = Number.parseInt(value, 10);
    if (!Number.isFinite(next) || next < 0) {
      setValue(String(quantity));
      toast.error(t('stock.status.invalidQty'));
      return;
    }
    if (next === quantity) {
      return;
    }
    adjust.mutate(
      { barcode, newQuantity: next, note: t('stock.status.inlineAdjustNote') },
      {
        onSuccess: () => toast.success(t('stock.status.updated')),
        onError: (e) => {
          setValue(String(quantity));
          toast.error(getApiErrorMessage(e));
        },
      },
    );
  };

  return (
    <Input
      className="h-8 w-20 text-right tabular-nums"
      inputMode="numeric"
      value={value}
      disabled={adjust.isPending}
      aria-label={`${productName} ${t('stock.status.currentStock')}`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function StockStatusTab(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const warehouseFromUrl = params.get('warehouse') ?? undefined;

  const overviewQuery = useStockOverview();
  const warehousesQuery = useWarehouses();
  const metaMapQuery = useProductMetaMap();

  const [warehouseId, setWarehouseId] = useState<string | undefined>(
    warehouseFromUrl,
  );

  useEffect(() => {
    if (warehouseFromUrl) {
      setWarehouseId(warehouseFromUrl);
    }
  }, [warehouseFromUrl]);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const warehouses: WarehouseDto[] = useMemo(
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data],
  );
  const metaMap = useMemo(
    () => metaMapQuery.data ?? new Map(),
    [metaMapQuery.data],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const meta of metaMap.values()) {
      if (meta.category?.trim()) {
        set.add(meta.category.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [metaMap]);

  const flatRows = useMemo((): FlatStockRow[] => {
    const list: FlatStockRow[] = [];
    for (const row of overviewQuery.data ?? []) {
      const meta = metaMap.get(row.barcode);
      for (const wh of row.byWarehouse) {
        if (warehouseId && wh.warehouseId !== warehouseId) {
          continue;
        }
        const net = Math.max(0, wh.quantity - wh.reservedQty);
        const status = getStockLevelStatus(
          net,
          meta?.reorderPoint,
          row.lowStock,
        );
        if (statusFilter && status !== statusFilter) {
          continue;
        }
        if (
          categoryFilter &&
          (meta?.category ?? '').trim() !== categoryFilter
        ) {
          continue;
        }
        list.push({
          key: `${row.barcode}-${wh.warehouseId}`,
          barcode: row.barcode,
          productName: row.productName ?? row.barcode,
          sku: row.sku,
          warehouseId: wh.warehouseId,
          warehouseName: wh.name,
          quantity: wh.quantity,
          reserved: wh.reservedQty,
          net,
          reorderPoint: meta?.reorderPoint ?? null,
          status,
          productId: meta?.productId ?? null,
        });
      }
    }
    return list.sort((a, b) => a.productName.localeCompare(b.productName, 'tr'));
  }, [
    overviewQuery.data,
    metaMap,
    warehouseId,
    statusFilter,
    categoryFilter,
  ]);

  if (overviewQuery.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
    );
  }
  if (overviewQuery.isError) {
    return (
      <p className="text-destructive text-sm">
        {getApiErrorMessage(overviewQuery.error)}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid min-w-[160px] flex-1 gap-1.5 sm:max-w-xs">
          <Label>{t('stock.status.warehouse')}</Label>
          <Select
            value={warehouseId ?? '__all__'}
            onValueChange={(v) =>
              setWarehouseId(v === '__all__' ? undefined : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t('stock.status.allWarehouses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('stock.status.allWarehouses')}</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-[160px] gap-1.5 sm:max-w-xs">
          <Label>{t('stock.status.stockStatus')}</Label>
          <Select
            value={statusFilter || '__all__'}
            onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('stock.status.allStatuses')}</SelectItem>
              <SelectItem value="NORMAL">{STOCK_LEVEL_LABELS.NORMAL}</SelectItem>
              <SelectItem value="LOW">{STOCK_LEVEL_LABELS.LOW}</SelectItem>
              <SelectItem value="CRITICAL">{STOCK_LEVEL_LABELS.CRITICAL}</SelectItem>
              <SelectItem value="OUT">{STOCK_LEVEL_LABELS.OUT}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-[160px] gap-1.5 sm:max-w-xs">
          <Label>{t('stock.status.category')}</Label>
          <Select
            value={categoryFilter || '__all__'}
            onValueChange={(v) => setCategoryFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('stock.status.allCategories')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {flatRows.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {t('stock.status.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('stock.status.product')}</TableHead>
                <TableHead>{t('stock.status.sku')}</TableHead>
                <TableHead>{t('stock.status.barcode')}</TableHead>
                <TableHead>{t('stock.status.warehouse')}</TableHead>
                <TableHead className="text-right">{t('stock.status.currentStock')}</TableHead>
                <TableHead className="text-right">{t('stock.status.reserved')}</TableHead>
                <TableHead className="text-right">{t('stock.status.net')}</TableHead>
                <TableHead className="text-right">{t('stock.status.reorderPoint')}</TableHead>
                <TableHead>{t('stock.status.stockStatus')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flatRows.map((row) => (
                <TableRow
                  key={row.key}
                  className={`cursor-pointer ${rowBackgroundClass(row.status)}`}
                  onClick={() => {
                    if (row.productId) {
                      navigate(`/products/${row.productId}`);
                    }
                  }}
                >
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.sku ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.barcode}</TableCell>
                  <TableCell className="text-sm">{row.warehouseName}</TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <InlineStockQty
                      barcode={row.barcode}
                      productName={row.productName}
                      quantity={row.quantity}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.reserved.toLocaleString('tr-TR')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {row.net.toLocaleString('tr-TR')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.reorderPoint?.toLocaleString('tr-TR') ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={stockLevelBadgeClass(row.status)}>
                      {STOCK_LEVEL_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
