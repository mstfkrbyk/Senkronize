import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
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

export function StockMovementsPage(): ReactElement {
  usePageTitle('Stok hareket geçmişi');

  const warehousesQuery = useWarehouses();
  const overviewQuery = useStockOverview();

  const [range, setRange] = useState(defaultDateRange);
  const [warehouseId, setWarehouseId] = useState('');
  const [typeGroup, setTypeGroup] = useState('');
  const [productSearch, setProductSearch] = useState('');
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
  const warehouses = warehousesQuery.data ?? [];

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

  const exportCsv = (): void => {
    const header = [
      'Tarih',
      'Ürün',
      'Barkod',
      'Depo',
      'Tip',
      'Miktar',
      'Önceki Stok',
      'Yeni Stok',
      'Kaynak',
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
          r.beforeQuantity,
          r.afterQuantity,
          movementSourceLabel(r.movementType, r.orderId, r.note),
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
    toast.success('CSV indirildi');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Stok hareket geçmişi
        </h1>
        <p className="text-muted-foreground">
          Tüm stok giriş, çıkış ve düzeltmelerini filtreleyin ve dışa aktarın.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Hareketler</CardTitle>
            <CardDescription>
              Depo, tip, tarih ve ürün araması ile listeleyin
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            CSV indir
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label>Depo</Label>
              <Select
                value={warehouseId || '__all__'}
                onValueChange={(v) => {
                  setPage(1);
                  setWarehouseId(v === '__all__' ? '' : v);
                }}
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
            <div className="space-y-1">
              <Label>Hareket tipi</Label>
              <Select
                value={typeGroup || '__all__'}
                onValueChange={(v) => {
                  setPage(1);
                  setTypeGroup(v === '__all__' ? '' : v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tümü</SelectItem>
                  {MOVEMENT_FILTER_GROUPS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mv-from">Başlangıç</Label>
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
              <Label htmlFor="mv-to">Bitiş</Label>
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
              <Label htmlFor="mv-search">Ürün arama</Label>
              <Input
                id="mv-search"
                placeholder="Barkod veya isim…"
                value={productSearch}
                onChange={(e) => {
                  setPage(1);
                  setProductSearch(e.target.value);
                }}
              />
            </div>
          </div>

          {historyQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Yükleniyor…</p>
          ) : historyQuery.isError ? (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(historyQuery.error)}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Bu filtrelere uygun hareket bulunamadı.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Ürün</TableHead>
                      <TableHead>Barkod</TableHead>
                      <TableHead>Depo</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead className="text-right">Miktar</TableHead>
                      <TableHead className="text-right">Önceki</TableHead>
                      <TableHead className="text-right">Yeni</TableHead>
                      <TableHead>Kaynak</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r: StockMovementDto) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(r.createdAt), 'dd.MM.yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="max-w-[140px] text-sm">
                          {productNameByBarcode.get(r.barcode) ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.barcode}
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
                        <TableCell className="text-right font-medium tabular-nums">
                          {r.quantity > 0 ? '+' : ''}
                          {r.quantity.toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.beforeQuantity.toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.afterQuantity.toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {movementSourceLabel(
                            r.movementType,
                            r.orderId,
                            r.note,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">
                  Toplam{' '}
                  {(typeGroup === 'COUNT'
                    ? rows.length
                    : historyQuery.data?.total ?? 0
                  ).toLocaleString('tr-TR')}{' '}
                  kayıt
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Önceki
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
                    Sonraki
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
