import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { usePageTitle } from '@/hooks/usePageTitle';

import { StockPageHeader } from './StockPageHeader';
import { getApiErrorMessage } from '@/lib/api';
import type { StockMovementDto } from '@/types/stock';

import {
  useStockHistoryOrg,
  useStockOverview,
  useWarehouses,
} from './hooks/useStockManagement';
import {
  MOVEMENT_FILTER_GROUPS,
  MOVEMENT_LABELS,
  movementBadgeClass,
  movementSourceLabel,
} from './stock-movement-labels';

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  };
}

function referenceLabel(row: StockMovementDto): string {
  if (row.orderId) {
    return `#${row.orderId.slice(0, 8)}`;
  }
  const note = row.note?.trim();
  if (note && note.length > 0) {
    return note.length > 40 ? `${note.slice(0, 40)}…` : note;
  }
  return '—';
}

function reasonLabel(row: StockMovementDto): string {
  return movementSourceLabel(row.movementType, row.orderId, row.note);
}

interface MovementsTabProps {
  embedded?: boolean;
}

export function StockMovementsTab({ embedded = false }: MovementsTabProps): ReactElement {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const warehousesQuery = useWarehouses();
  const overviewQuery = useStockOverview();

  const [range, setRange] = useState(defaultDateRange);
  const [warehouseId, setWarehouseId] = useState(params.get('warehouse') ?? '');
  const [typeGroup, setTypeGroup] = useState('');
  const [productSearch, setProductSearch] = useState(params.get('barcode') ?? '');
  const [page, setPage] = useState(1);
  const limit = 25;

  const selectedGroup = MOVEMENT_FILTER_GROUPS.find((g) => g.value === typeGroup);

  const historyFilters = useMemo(
    () => ({
      from: range.from ? `${range.from}T00:00:00.000Z` : undefined,
      to: range.to ? `${range.to}T23:59:59.999Z` : undefined,
      movementTypes:
        selectedGroup && selectedGroup.value !== 'COUNT'
          ? selectedGroup.types.join(',')
          : selectedGroup?.value === 'COUNT'
            ? 'ADJUSTMENT'
            : undefined,
      barcode: productSearch.trim() || undefined,
      warehouseId: warehouseId || undefined,
      page,
      limit,
    }),
    [
      range.from,
      range.to,
      selectedGroup,
      productSearch,
      warehouseId,
      page,
    ],
  );

  const historyQuery = useStockHistoryOrg(historyFilters);
  const warehouses = useMemo(
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data],
  );

  const productNameByBarcode = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of overviewQuery.data ?? []) {
      if (row.productName) {
        map.set(row.barcode, row.productName);
      }
    }
    return map;
  }, [overviewQuery.data]);

  const warehouseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses) {
      map.set(w.id, w.name);
    }
    return map;
  }, [warehouses]);

  const rows = useMemo(() => {
    const data = historyQuery.data?.data ?? [];
    if (typeGroup !== 'COUNT') {
      return data;
    }
    return data.filter((r) => {
      const n = (r.note ?? '').toLowerCase();
      return n.includes('sayım') || n.includes('sayim');
    });
  }, [historyQuery.data?.data, typeGroup]);

  const syncParams = (wh: string, barcode: string): void => {
    const next = new URLSearchParams(params);
    if (wh) {
      next.set('warehouse', wh);
    } else {
      next.delete('warehouse');
    }
    if (barcode.trim()) {
      next.set('barcode', barcode.trim());
    } else {
      next.delete('barcode');
    }
    setParams(next, { replace: true });
  };

  const exportCsv = (): void => {
    const header = [
      'Tarih',
      'Ürün',
      'Barkod',
      'Depo',
      'Tip',
      'Miktar',
      'Neden',
      'Referans',
      'Kullanıcı',
    ];
    const lines = [
      header.join(';'),
      ...rows.map((r) =>
        [
          r.createdAt,
          productNameByBarcode.get(r.barcode) ?? '',
          r.barcode,
          r.warehouseId
            ? (warehouseNameById.get(r.warehouseId) ?? r.warehouseId)
            : '',
          MOVEMENT_LABELS[r.movementType] ?? r.movementType,
          r.quantity,
          reasonLabel(r),
          referenceLabel(r),
          'Sistem',
        ].join(';'),
      ),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stok-hareketleri-${range.from}-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('stock.movements.exportSuccess'));
  };

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <StockPageHeader
          title={t('stock.movements.pageTitle')}
          description={t('stock.movements.pageDesc')}
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>{t('stock.movements.cardTitle')}</CardTitle>
            <CardDescription>{t('stock.movements.cardDesc')}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            {t('stock.movements.exportCsv')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label>{t('stock.warehouse')}</Label>
              <Select
                value={warehouseId || '__all__'}
                onValueChange={(v) => {
                  setPage(1);
                  const id = v === '__all__' ? '' : v;
                  setWarehouseId(id);
                  syncParams(id, productSearch);
                }}
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
            <div className="space-y-1">
              <Label>{t('stock.movements.movementType')}</Label>
              <Select
                value={typeGroup || '__all__'}
                onValueChange={(v) => {
                  setPage(1);
                  setTypeGroup(v === '__all__' ? '' : v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.all')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('common.all')}</SelectItem>
                  {MOVEMENT_FILTER_GROUPS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mv-from">{t('stock.movements.dateFrom')}</Label>
              <Input
                id="mv-from"
                type="date"
                value={range.from}
                onChange={(e) => {
                  setPage(1);
                  setRange((r) => ({ ...r, from: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mv-to">{t('stock.movements.dateTo')}</Label>
              <Input
                id="mv-to"
                type="date"
                value={range.to}
                onChange={(e) => {
                  setPage(1);
                  setRange((r) => ({ ...r, to: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mv-search">{t('stock.status.product')}</Label>
              <Input
                id="mv-search"
                placeholder={t('stock.movements.productPlaceholder')}
                value={productSearch}
                onChange={(e) => {
                  setPage(1);
                  setProductSearch(e.target.value);
                  syncParams(warehouseId, e.target.value);
                }}
              />
            </div>
          </div>

          {historyQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
          ) : historyQuery.isError ? (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(historyQuery.error)}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('stock.movements.empty')}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead>{t('stock.status.product')}</TableHead>
                      <TableHead>{t('stock.warehouse')}</TableHead>
                      <TableHead>{t('stock.movements.colType')}</TableHead>
                      <TableHead className="text-right">{t('common.quantity')}</TableHead>
                      <TableHead>{t('stock.movements.colReason')}</TableHead>
                      <TableHead>{t('stock.movements.colReference')}</TableHead>
                      <TableHead>{t('stock.movements.colUser')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r: StockMovementDto) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(r.createdAt), 'dd.MM.yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="max-w-[160px]">
                          <div className="line-clamp-2 text-sm font-medium">
                            {productNameByBarcode.get(r.barcode) ?? '—'}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {r.barcode}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.warehouseId
                            ? (warehouseNameById.get(r.warehouseId) ?? '—')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={movementBadgeClass(
                              r.movementType,
                              r.quantity,
                            )}
                          >
                            {MOVEMENT_LABELS[r.movementType] ?? r.movementType}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium tabular-nums ${
                            r.quantity >= 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {r.quantity > 0 ? '+' : ''}
                          {r.quantity.toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-sm">{reasonLabel(r)}</TableCell>
                        <TableCell className="max-w-[140px] truncate text-sm">
                          {referenceLabel(r)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {t('stock.movements.systemUser')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">
                  {t('stock.movements.totalRecords', {
                    count: (typeGroup === 'COUNT'
                      ? rows.length
                      : historyQuery.data?.total ?? 0
                    ).toLocaleString('tr-TR'),
                  })}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t('common.previous')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      typeGroup === 'COUNT'
                        ? false
                        : (historyQuery.data?.data.length ?? 0) < limit
                    }
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StockMovementPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('nav.stockMovements'));
  return <StockMovementsTab />;
}
