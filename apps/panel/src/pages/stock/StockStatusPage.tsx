import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Download, Loader2, ShoppingCart } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, getApiErrorMessage } from '@/lib/api';
import { openQuickStockAdjust } from '@/lib/quick-stock-adjust';
import {
  useStockOverview,
  useWarehouses,
} from '@/pages/stock/hooks/useStockManagement';
import type { StockOverviewRow } from '@/types/stock';
import type {
  DailyMovementFlowPoint,
  StockoutEstimateDto,
} from '@/types/stock-forecast';

function reorderRows(rows: StockoutEstimateDto[]): StockoutEstimateDto[] {
  return rows.filter(
    (r) =>
      r.belowReorder ||
      (r.reorderPoint !== null &&
        r.reorderPoint !== undefined &&
        r.currentStock < r.reorderPoint) ||
      (r.daysUntilStockout !== null &&
        Number.isFinite(r.daysUntilStockout) &&
        r.daysUntilStockout < 14),
  );
}

function exportReorderCsv(rows: StockoutEstimateDto[]): void {
  const header = [
    'Ürün',
    'Barkod',
    'Mevcut stok',
    'Kritik seviye',
    'Günlük ort. satış',
    'Önerilen sipariş',
    'Tükenme (gün)',
  ];
  const lines = [
    header.join(';'),
    ...rows.map((r) =>
      [
        r.name.replaceAll(';', ','),
        r.barcode,
        r.currentStock,
        r.reorderPoint ?? '',
        r.dailyVelocity,
        r.recommendedOrderQty,
        r.daysUntilStockout ?? '',
      ].join(';'),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yeniden-siparis-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV indirildi');
}

function StockMovementFlowChart(): ReactElement {
  const flowQuery = useQuery({
    queryKey: ['stock', 'movements', 'daily', 30],
    queryFn: async (): Promise<DailyMovementFlowPoint[]> => {
      const { data } = await api.get<{ data: DailyMovementFlowPoint[] }>(
        '/stock/movements/daily',
        { params: { days: 30 } },
      );
      return data.data;
    },
  });

  const chartData = useMemo(
    () =>
      (flowQuery.data ?? []).map((d) => ({
        ...d,
        label: format(parseISO(d.date), 'd MMM', { locale: tr }),
      })),
    [flowQuery.data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stok hareket grafiği</CardTitle>
        <CardDescription>Son 30 gün giriş ve çıkış</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        {flowQuery.isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Yükleniyor…
          </div>
        ) : flowQuery.isError ? (
          <p className="text-destructive text-sm">
            {getApiErrorMessage(flowQuery.error)}
          </p>
        ) : chartData.length === 0 ? (
          <p className="text-muted-foreground text-sm">Hareket verisi yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="inflow"
                name="Giriş"
                stackId="flow"
                fill="#22c55e"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="outflow"
                name="Çıkış"
                stackId="flow"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function StockOverviewTable(): ReactElement {
  const [params] = useSearchParams();
  const warehouseId = params.get('warehouse') ?? undefined;
  const overviewQuery = useStockOverview();
  const warehousesQuery = useWarehouses();

  const warehouseName = warehousesQuery.data?.find(
    (w) => w.id === warehouseId,
  )?.name;

  const rows = useMemo((): StockOverviewRow[] => {
    const all = overviewQuery.data ?? [];
    if (!warehouseId) {
      return all;
    }
    return all.filter((row) =>
      row.byWarehouse.some((w) => w.warehouseId === warehouseId),
    );
  }, [overviewQuery.data, warehouseId]);

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
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Kayıt yok.</p>;
  }

  return (
    <div className="space-y-2">
      {warehouseId && warehouseName ? (
        <Badge variant="outline" className="bg-sky-50">
          Depo filtresi: {warehouseName}
        </Badge>
      ) : null}
      <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ürün</TableHead>
            <TableHead>Barkod</TableHead>
            <TableHead className="text-right">
              {warehouseId ? 'Depo stok' : 'Kullanılabilir'}
            </TableHead>
            <TableHead className="text-right">Rezerve</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const wh = warehouseId
              ? row.byWarehouse.find((w) => w.warehouseId === warehouseId)
              : undefined;
            const qty = wh?.quantity ?? row.available;
            const reserved = wh?.reservedQty ?? row.totalReserved;
            return (
            <TableRow key={row.barcode}>
              <TableCell className="max-w-[200px] font-medium line-clamp-2">
                {row.productName ?? '—'}
              </TableCell>
              <TableCell className="font-mono text-xs">{row.barcode}</TableCell>
              <TableCell className="text-right tabular-nums">
                {qty.toLocaleString('tr-TR')}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {reserved.toLocaleString('tr-TR')}
              </TableCell>
              <TableCell>
                {row.lowStock ? (
                  <Badge variant="destructive" className="text-xs">
                    Düşük stok
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Normal
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    openQuickStockAdjust({
                      barcode: row.barcode,
                      productName: row.productName ?? row.barcode,
                      currentQty: qty,
                    })
                  }
                >
                  Düzelt
                </Button>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

function ReorderSuggestionsTab(): ReactElement {
  const forecastQuery = useQuery({
    queryKey: ['stock-forecast', 'bulk'],
    queryFn: async (): Promise<StockoutEstimateDto[]> => {
      const { data } = await api.get<{ data: StockoutEstimateDto[] }>(
        '/stock/forecast',
      );
      return data.data;
    },
  });

  const rows = useMemo(
    () => reorderRows(forecastQuery.data ?? []),
    [forecastQuery.data],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Yeniden sipariş önerileri</CardTitle>
          <CardDescription>
            Kritik seviye altı veya yakın tükenme riski olan ürünler
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => exportReorderCsv(rows)}
          >
            <Download className="mr-2 size-4" />
            CSV dışa aktar
          </Button>
          <Button type="button" size="sm" asChild>
            <Link to="/suppliers">
              <ShoppingCart className="mr-2 size-4" />
              Tedarikçiye sipariş oluştur
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {forecastQuery.isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Yükleniyor…
          </div>
        ) : forecastQuery.isError ? (
          <p className="text-destructive text-sm">
            {getApiErrorMessage(forecastQuery.error)}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Yeniden sipariş önerisi gerektiren ürün yok.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="text-right">Mevcut</TableHead>
                  <TableHead className="text-right">Kritik seviye</TableHead>
                  <TableHead className="text-right">Günlük satış</TableHead>
                  <TableHead className="text-right">Önerilen miktar</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.productId}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {r.barcode}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.currentStock.toLocaleString('tr-TR')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.reorderPoint?.toLocaleString('tr-TR') ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.dailyVelocity.toLocaleString('tr-TR')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {r.recommendedOrderQty.toLocaleString('tr-TR')}
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link to="/suppliers">Sipariş</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StockStatusPage(): ReactElement {
  return (
    <Tabs defaultValue="status" className="space-y-4">
      <TabsList>
        <TabsTrigger value="status">Stok durumu</TabsTrigger>
        <TabsTrigger value="reorder">Yeniden sipariş ver</TabsTrigger>
      </TabsList>

      <TabsContent value="status" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Ürün bazlı stok</CardTitle>
            <CardDescription>Güncel kullanılabilir stok özeti</CardDescription>
          </CardHeader>
          <CardContent>
            <StockOverviewTable />
          </CardContent>
        </Card>
        <StockMovementFlowChart />
      </TabsContent>

      <TabsContent value="reorder">
        <ReorderSuggestionsTab />
      </TabsContent>
    </Tabs>
  );
}
