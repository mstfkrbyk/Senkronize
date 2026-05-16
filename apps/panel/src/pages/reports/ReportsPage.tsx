import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';
import type { ReportFilters, SalesReportData } from '@/types/report';

import { PlatformBreakdown } from './PlatformBreakdown';
import { SalesChart } from './SalesChart';
import { usePlatformReport, useSalesReport, useTopProducts } from './hooks/useReports';
import {
  aggregateSalesByGroup,
  filterSalesByDateRange,
  filterSalesByPlatform,
  summarizeSales,
} from './reportAggregation';

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = subDays(end, 30);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

function downloadCSV(data: SalesReportData[], filename: string): void {
  const headers = ['Tarih', 'Sipariş Sayısı', 'Gelir (TL)'];
  const rows = data.map((d) => [d.period, String(d.totalOrders), d.totalRevenue.toFixed(2)]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage(): ReactElement {
  const initialRange = useMemo(() => defaultDateRange(), []);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [platform, setPlatform] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const filters: ReportFilters = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      platform: platform === 'all' ? undefined : platform,
      groupBy,
    }),
    [startDate, endDate, platform, groupBy],
  );

  const salesQuery = useSalesReport(filters);
  const platformQuery = usePlatformReport(filters);
  const topProductsQuery = useTopProducts(20);

  const chartRows = useMemo(() => {
    const rows = salesQuery.data?.rows ?? [];
    let next = filterSalesByDateRange(rows, filters.startDate, filters.endDate);
    next = filterSalesByPlatform(next, filters.platform);
    return aggregateSalesByGroup(next, filters.groupBy ?? 'day');
  }, [salesQuery.data?.rows, filters]);

  const platformPieSlices = useMemo(() => {
    const rows = platformQuery.data ?? [];
    return rows.map((r) => ({
      name: r.platform,
      value: r.totalRevenue,
    }));
  }, [platformQuery.data]);

  const summary = useMemo(() => summarizeSales(chartRows), [chartRows]);

  const showSampleBanner = salesQuery.data?.kind === 'mock';
  const isSalesLoading = salesQuery.isFetching && salesQuery.data?.kind === 'placeholder';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Raporlar</h1>
          <p className="text-muted-foreground">
            Satış performansınızı tarih aralığı, platform ve gruplamaya göre inceleyin.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={chartRows.length === 0}
          onClick={() =>
            downloadCSV(
              chartRows,
              `satis-raporu-${filters.startDate ?? 'baslangic'}-${filters.endDate ?? 'bitis'}.csv`,
            )
          }
        >
          CSV İndir
        </Button>
      </div>

      {showSampleBanner ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Rapor sunucusuna ulaşılamadı; grafikler örnek veri ile gösteriliyor.
        </div>
      ) : null}

      {salesQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(salesQuery.error)}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="rep-start">Başlangıç</Label>
            <Input
              id="rep-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rep-end">Bitiş</Label>
            <Input
              id="rep-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="TRENDYOL">Trendyol</SelectItem>
                <SelectItem value="HEPSIBURADA">Hepsiburada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gruplama</Label>
            <Select
              value={groupBy}
              onValueChange={(v) => setGroupBy(v as 'day' | 'week' | 'month')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Gün</SelectItem>
                <SelectItem value="week">Hafta</SelectItem>
                <SelectItem value="month">Ay</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam sipariş
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSalesLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-semibold text-primary">{summary.totalOrders}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam gelir
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSalesLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-semibold text-primary">
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  maximumFractionDigits: 0,
                }).format(summary.totalRevenue)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ortalama sipariş değeri
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSalesLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-semibold text-primary">
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  maximumFractionDigits: 0,
                }).format(summary.averageOrderValue)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SalesChart data={chartRows} />
        {platformQuery.isLoading ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform dağılımı</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <Skeleton className="h-full w-full rounded-md" />
            </CardContent>
          </Card>
        ) : (
          <PlatformBreakdown data={platformPieSlices} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">En çok satan ürünler</CardTitle>
        </CardHeader>
        <CardContent>
          {topProductsQuery.isError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(topProductsQuery.error)}</p>
          ) : null}
          {topProductsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (topProductsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Ürün raporu için veri bulunamadı.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barkod</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">Sipariş sayısı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(topProductsQuery.data ?? []).map((row) => (
                    <TableRow key={row.barcode}>
                      <TableCell className="font-mono text-sm">{row.barcode}</TableCell>
                      <TableCell className="text-right">{row.totalQuantity}</TableCell>
                      <TableCell className="text-right">{row.orderCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
