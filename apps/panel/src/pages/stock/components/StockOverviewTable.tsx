import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { History, MoreHorizontal, Pencil, ArrowRightLeft } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { openQuickStockAdjust } from '@/lib/quick-stock-adjust';
import type { StockOverviewRow, WarehouseDto } from '@/types/stock';

import { useProductMetaMap } from '../hooks/useProductMetaMap';
import {
  useStockHistoryOrg,
  useStockOverview,
  useWarehouses,
} from '../hooks/useStockManagement';
import {
  getStockLevelStatus,
  STOCK_LEVEL_LABELS,
  stockLevelBadgeClass,
} from '../stock-status';

interface Props {
  search: string;
  warehouseId: string | undefined;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onWarehouseChange: (value: string | undefined) => void;
  onStatusFilterChange: (value: string) => void;
}

function formatRelative(iso: string | undefined): string {
  if (!iso) {
    return '—';
  }
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: tr });
  } catch {
    return '—';
  }
}

export function StockOverviewTable({
  search,
  warehouseId,
  statusFilter,
  onSearchChange,
  onWarehouseChange,
  onStatusFilterChange,
}: Props): ReactElement {
  const overviewQuery = useStockOverview();
  const warehousesQuery = useWarehouses();
  const metaMapQuery = useProductMetaMap();

  const historyQuery = useStockHistoryOrg({
    limit: 300,
    page: 1,
  });

  const warehouses: WarehouseDto[] = useMemo(
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data],
  );
  const metaMap = useMemo(
    () => metaMapQuery.data ?? new Map(),
    [metaMapQuery.data],
  );

  const lastMovementByBarcode = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of historyQuery.data?.data ?? []) {
      if (!map.has(row.barcode)) {
        map.set(row.barcode, row.createdAt);
      }
    }
    return map;
  }, [historyQuery.data?.data]);

  const rows = useMemo((): StockOverviewRow[] => {
    let list = overviewQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (r) =>
          r.barcode.toLowerCase().includes(term) ||
          (r.productName ?? '').toLowerCase().includes(term) ||
          (r.sku ?? '').toLowerCase().includes(term),
      );
    }
    if (warehouseId) {
      list = list.filter((r) =>
        r.byWarehouse.some((w) => w.warehouseId === warehouseId),
      );
    }
    if (statusFilter) {
      list = list.filter((r) => {
        const meta = metaMap.get(r.barcode);
        const status = getStockLevelStatus(
          r.available,
          meta?.reorderPoint,
          r.lowStock,
        );
        return status === statusFilter;
      });
    }
    return list;
  }, [overviewQuery.data, search, warehouseId, statusFilter, metaMap]);

  const visibleWarehouses = useMemo(() => {
    if (warehouseId) {
      return warehouses.filter((w) => w.id === warehouseId);
    }
    return warehouses;
  }, [warehouses, warehouseId]);

  if (overviewQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Yükleniyor…</p>;
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
        <div className="grid min-w-[200px] flex-1 gap-1.5">
          <Label htmlFor="stock-overview-search">Ara</Label>
          <Input
            id="stock-overview-search"
            placeholder="Ürün adı, barkod veya SKU"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="grid min-w-[160px] gap-1.5">
          <Label>Depo</Label>
          <Select
            value={warehouseId ?? '__all__'}
            onValueChange={(v) =>
              onWarehouseChange(v === '__all__' ? undefined : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tüm depolar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm depolar</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-[160px] gap-1.5">
          <Label>Durum</Label>
          <Select value={statusFilter || '__all__'} onValueChange={onStatusFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tümü</SelectItem>
              <SelectItem value="NORMAL">Normal</SelectItem>
              <SelectItem value="LOW">Düşük</SelectItem>
              <SelectItem value="CRITICAL">Kritik</SelectItem>
              <SelectItem value="OUT">Tükendi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Bu filtrelere uygun stok kaydı yok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Ürün</TableHead>
                {visibleWarehouses.map((w) => (
                  <TableHead key={w.id} className="text-right whitespace-nowrap">
                    {w.name}
                  </TableHead>
                ))}
                <TableHead className="text-right">Toplam</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Eşik / Yeniden sipariş
                </TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Son hareket</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const meta = metaMap.get(row.barcode);
                const status = getStockLevelStatus(
                  row.available,
                  meta?.reorderPoint,
                  row.lowStock,
                );
                const whQty = (id: string): number =>
                  row.byWarehouse.find((w) => w.warehouseId === id)?.quantity ??
                  0;

                return (
                  <TableRow key={row.barcode}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {meta?.imageUrl ? (
                          <img
                            src={meta.imageUrl}
                            alt=""
                            className="size-10 shrink-0 rounded-md border object-cover"
                          />
                        ) : (
                          <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md border text-xs text-muted-foreground">
                            —
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium">
                            {row.productName ?? row.barcode}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {row.sku ? `SKU: ${row.sku}` : row.barcode}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    {visibleWarehouses.map((w) => (
                      <TableCell
                        key={w.id}
                        className="text-right tabular-nums text-sm"
                      >
                        {whQty(w.id).toLocaleString('tr-TR')}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums font-medium">
                      {row.totalQuantity.toLocaleString('tr-TR')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      <div>{meta?.reorderPoint?.toLocaleString('tr-TR') ?? '—'}</div>
                      <div className="text-muted-foreground text-xs">
                        {meta?.reorderQty
                          ? `Sip: ${meta.reorderQty.toLocaleString('tr-TR')}`
                          : '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={stockLevelBadgeClass(status)}>
                        {STOCK_LEVEL_LABELS[status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                      {formatRelative(lastMovementByBarcode.get(row.barcode))}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Aksiyonlar"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              openQuickStockAdjust({
                                barcode: row.barcode,
                                productName: row.productName ?? row.barcode,
                                currentQty: row.totalQuantity,
                              })
                            }
                          >
                            <Pencil className="mr-2 size-4" />
                            Stok güncelle
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/products?tab=transfers&barcode=${encodeURIComponent(row.barcode)}`}
                            >
                              <ArrowRightLeft className="mr-2 size-4" />
                              Transfer oluştur
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/products?tab=movements&barcode=${encodeURIComponent(row.barcode)}`}
                            >
                              <History className="mr-2 size-4" />
                              Geçmiş görüntüle
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
