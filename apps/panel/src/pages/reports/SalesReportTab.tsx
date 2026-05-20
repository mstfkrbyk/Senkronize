import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { BarChart2, Download, Loader2, Printer } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';
import { exportToCsv } from '@/lib/csv-export';
import { printReport } from '@/lib/pdf-export';
import type { ReportFilters } from '@/types/report';

import { PlatformComparisonBarChart } from './PlatformComparisonBarChart';
import { StackedPlatformAreaChart } from './StackedPlatformAreaChart';
import {
  usePlatformComparison,
  useSalesReport,
  useTopProducts,
} from './hooks/useReports';
import { useReportPdfDownload } from './hooks/useReportPdfDownload';
import {
  aggregateSalesByGroup,
  buildSalesDetailRows,
  buildStackedChartData,
  filterSalesByDateRange,
  filterSalesByPlatforms,
  platformRevenueShares,
  summarizeSales,
} from './reportAggregation';
import {
  formatTry,
  pdfPeriodFromDates,
  periodRangeFromPreset,
  platformDisplayName,
  SALES_PLATFORM_OPTIONS,
  type PeriodPreset,
} from './report-utils';

export function SalesReportTab(): ReactElement {
  const initial = useMemo(() => periodRangeFromPreset('30'), []);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const { downloading, downloadPdf } = useReportPdfDownload();

  const filters: ReportFilters = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
      groupBy,
    }),
    [startDate, endDate, selectedPlatforms, groupBy],
  );

  const salesQuery = useSalesReport(filters);
  const platformCompareQuery = usePlatformComparison(
    { startDate, endDate },
    { enabled: Boolean(startDate && endDate) },
  );
  const topProductsQuery = useTopProducts(20);

  const returnRateByPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of platformCompareQuery.data?.platforms ?? []) {
      map[row.name] = row.returnRate;
    }
    return map;
  }, [platformCompareQuery.data]);

  const chartRows = useMemo(() => {
    const rows = salesQuery.data?.rows ?? [];
    let next = filterSalesByDateRange(rows, filters.startDate, filters.endDate);
    next = filterSalesByPlatforms(next, filters.platforms);
    return aggregateSalesByGroup(next, filters.groupBy ?? 'day');
  }, [salesQuery.data?.rows, filters]);

  const stackedData = useMemo(() => buildStackedChartData(chartRows), [chartRows]);
  const stackedPlatforms = useMemo(() => {
    const set = new Set<string>();
    for (const row of chartRows) {
      for (const p of Object.keys(row.byPlatform)) set.add(p);
    }
    return Array.from(set);
  }, [chartRows]);

  const barCompareData = useMemo(
    () =>
      platformRevenueShares(chartRows).map((s) => ({
        platform: s.name,
        revenue: s.value,
        orders: chartRows.reduce(
          (sum, r) => sum + (r.byPlatform[s.name] ?? 0),
          0,
        ),
      })),
    [chartRows],
  );

  const detailRows = useMemo(
    () => buildSalesDetailRows(chartRows, returnRateByPlatform),
    [chartRows, returnRateByPlatform],
  );

  const summary = useMemo(() => summarizeSales(chartRows), [chartRows]);
  const showSampleBanner = salesQuery.data?.kind === 'mock';
  const isSalesLoading =
    salesQuery.isFetching && salesQuery.data?.kind === 'placeholder';

  function applyPreset(preset: PeriodPreset): void {
    if (preset === 'custom') {
      setPeriodPreset('custom');
      return;
    }
    const range = periodRangeFromPreset(preset);
    setStartDate(range.start);
    setEndDate(range.end);
    setPeriodPreset(preset);
  }

  function togglePlatform(p: string): void {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function exportDetailCsv(): void {
    if (detailRows.length === 0) return;
    exportToCsv(
      detailRows.map((r) => ({
        Tarih: r.period,
        Platform: platformDisplayName(r.platform),
        Sipariş: r.orders,
        'Gelir (TL)': r.revenue,
        'İade (TL)': r.returns,
        'Net gelir (TL)': r.netRevenue,
      })),
      'satis-raporu-detay',
    );
  }

  return (
    <div id="report-content" className="space-y-6">
      {salesQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(salesQuery.error)}
        </div>
      ) : null}

      {!isSalesLoading &&
      !salesQuery.isError &&
      chartRows.length === 0 &&
      !showSampleBanner ? (
        <EmptyState
          icon={BarChart2}
          title="Henüz yeterli veri yok"
          description="Raporlar sync başladıktan sonra oluşacak."
          secondaryAction={{ label: 'Bağlantılara git', href: '/connections' }}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={downloading === 'sales'}
          onClick={() => void downloadPdf('sales', pdfPeriodFromDates(startDate, endDate))}
        >
          {downloading === 'sales' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          PDF İndir
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => printReport('report-content', 'Satış raporu')}
        >
          <Printer className="mr-2 h-4 w-4" />
          Yazdır / PDF
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={detailRows.length === 0}
          onClick={exportDetailCsv}
        >
          Excel CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['7', 'Son 7 gün'],
                ['30', 'Son 30 gün'],
                ['90', 'Son 90 gün'],
                ['ytd', 'Bu yıl'],
                ['custom', 'Özel tarih'],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={periodPreset === key ? 'default' : 'outline'}
                onClick={() => applyPreset(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="rep-start">Başlangıç</Label>
              <Input
                id="rep-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPeriodPreset('custom');
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rep-end">Bitiş</Label>
              <Input
                id="rep-end"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPeriodPreset('custom');
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start">
                    {selectedPlatforms.length === 0
                      ? 'Tümü'
                      : `${selectedPlatforms.length} platform seçili`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start">
                  <div className="space-y-2">
                    {SALES_PLATFORM_OPTIONS.map((p) => (
                      <label
                        key={p}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedPlatforms.includes(p)}
                          onCheckedChange={() => togglePlatform(p)}
                        />
                        {platformDisplayName(p)}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rep-groupby">Gruplama</Label>
              <Select
                value={groupBy}
                onValueChange={(v) => setGroupBy(v as 'day' | 'week' | 'month')}
              >
                <SelectTrigger id="rep-groupby">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Günlük</SelectItem>
                  <SelectItem value="week">Haftalık</SelectItem>
                  <SelectItem value="month">Aylık</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                {formatTry(summary.totalRevenue)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ortalama sepet
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSalesLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-semibold text-primary">
                {formatTry(summary.averageOrderValue)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StackedPlatformAreaChart data={stackedData} platforms={stackedPlatforms} />
        <PlatformComparisonBarChart data={barCompareData} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Satış detayı</CardTitle>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={detailRows.length === 0}
            onClick={exportDetailCsv}
          >
            CSV İndir
          </Button>
        </CardHeader>
        <CardContent>
          {detailRows.length === 0 && !isSalesLoading ? (
            <p className="text-sm text-muted-foreground">Tablo için veri yok.</p>
          ) : (
            <div className="rounded-md border">
              <Table aria-label="Satış detay tablosu">
                <TableCaption className="sr-only">
                  Tarih, platform, sipariş, gelir, iade ve net gelir
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Sipariş</TableHead>
                    <TableHead className="text-right">Gelir</TableHead>
                    <TableHead className="text-right">İade</TableHead>
                    <TableHead className="text-right">Net gelir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.map((row) => (
                    <TableRow key={`${row.period}-${row.platform}`}>
                      <TableCell>{row.period}</TableCell>
                      <TableCell>{platformDisplayName(row.platform)}</TableCell>
                      <TableCell className="text-right">{row.orders}</TableCell>
                      <TableCell className="text-right">{formatTry(row.revenue)}</TableCell>
                      <TableCell className="text-right text-amber-700">
                        {formatTry(row.returns)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatTry(row.netRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            İade tutarları platform iptal/iade oranına göre tahminidir.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">En çok satan ürünler</CardTitle>
        </CardHeader>
        <CardContent>
          {(topProductsQuery.data ?? []).length === 0 && !topProductsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Ürün raporu için veri bulunamadı.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barkod</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">Sipariş</TableHead>
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
