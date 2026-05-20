import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { BarChart2, Download, Loader2, Printer, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';
import { exportToCsv } from '@/lib/csv-export';
import { printReport } from '@/lib/pdf-export';
import type { ReportFilters } from '@/types/report';

import { ReportPeriodSelector } from './components/ReportPeriodSelector';
import { RevenueAreaChart } from './components/RevenueAreaChart';
import {
  usePlatformComparison,
  useSalesReport,
} from './hooks/useReports';
import { useReportPdfDownload } from './hooks/useReportPdfDownload';
import { ShareReportModal } from './ShareReportModal';
import {
  aggregateSalesByGroup,
  buildPlatformSalesTable,
  buildSalesDetailRows,
  filterSalesByDateRange,
  filterSalesByPlatforms,
  summarizeSales,
  weightedReturnRate,
} from './reportAggregation';
import {
  formatTry,
  pdfPeriodFromDates,
  platformDisplayName,
  SALES_PLATFORM_OPTIONS,
  salesPeriodRangeFromPreset,
  type SalesPeriodPreset,
} from './report-utils';

export function SalesReportTab(): ReactElement {
  const { t } = useTranslation();
  const initial = useMemo(() => salesPeriodRangeFromPreset('month'), []);
  const [periodPreset, setPeriodPreset] = useState<SalesPeriodPreset>('month');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [shareOpen, setShareOpen] = useState(false);

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

  const revenueTrend = useMemo(
    () => chartRows.map((row) => ({ period: row.period, revenue: row.totalRevenue })),
    [chartRows],
  );

  const platformTable = useMemo(
    () => buildPlatformSalesTable(chartRows),
    [chartRows],
  );

  const detailRows = useMemo(
    () => buildSalesDetailRows(chartRows, returnRateByPlatform),
    [chartRows, returnRateByPlatform],
  );

  const summary = useMemo(() => summarizeSales(chartRows), [chartRows]);
  const returnRate = useMemo(
    () => weightedReturnRate(chartRows, returnRateByPlatform),
    [chartRows, returnRateByPlatform],
  );

  const showSampleBanner = salesQuery.data?.kind === 'mock';
  const isSalesLoading =
    salesQuery.isFetching && salesQuery.data?.kind === 'placeholder';

  function applyPreset(preset: SalesPeriodPreset): void {
    if (preset === 'custom') {
      setPeriodPreset('custom');
      return;
    }
    const range = salesPeriodRangeFromPreset(preset);
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

  function exportPlatformCsv(): void {
    if (platformTable.length === 0) return;
    exportToCsv(
      platformTable.map((r) => ({
        Platform: platformDisplayName(r.platform),
        Sipariş: r.orders,
        'Gelir (TL)': r.revenue,
        'Oran %': r.sharePct.toFixed(1),
      })),
      'satis-platform',
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
          title={t('reports.sales.emptyTitle')}
          description={t('reports.sales.emptyDesc')}
          secondaryAction={{ label: t('nav.connections'), href: '/connections' }}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShareOpen(true)}>
          <Share2 className="mr-2 h-4 w-4" />
          {t('reports.share.action')}
        </Button>
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
          {t('reports.export.pdf')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => printReport('report-content', t('reports.tabs.sales'))}
        >
          <Printer className="mr-2 h-4 w-4" />
          {t('reports.export.print')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={detailRows.length === 0}
          onClick={exportDetailCsv}
        >
          {t('reports.export.csv')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reports.filters.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ReportPeriodSelector
            preset={periodPreset}
            startDate={startDate}
            endDate={endDate}
            onPresetChange={applyPreset}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('reports.filters.platform')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start">
                    {selectedPlatforms.length === 0
                      ? t('reports.filters.allPlatforms')
                      : t('reports.filters.platformCount', { count: selectedPlatforms.length })}
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
              <Label htmlFor="rep-groupby">{t('reports.filters.groupBy')}</Label>
              <Select
                value={groupBy}
                onValueChange={(v) => setGroupBy(v as 'day' | 'week' | 'month')}
              >
                <SelectTrigger id="rep-groupby">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">{t('reports.filters.daily')}</SelectItem>
                  <SelectItem value="week">{t('reports.filters.weekly')}</SelectItem>
                  <SelectItem value="month">{t('reports.filters.monthly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('reports.kpi.orders')}
          value={String(summary.totalOrders)}
          loading={isSalesLoading}
        />
        <KpiCard
          label={t('reports.kpi.revenue')}
          value={formatTry(summary.totalRevenue)}
          loading={isSalesLoading}
        />
        <KpiCard
          label={t('reports.kpi.avgOrder')}
          value={formatTry(summary.averageOrderValue)}
          loading={isSalesLoading}
        />
        <KpiCard
          label={t('reports.kpi.returnRate')}
          value={`${returnRate.toFixed(1)}%`}
          loading={isSalesLoading || platformCompareQuery.isLoading}
        />
      </div>

      <RevenueAreaChart data={revenueTrend} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{t('reports.sales.platformTable')}</CardTitle>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={platformTable.length === 0}
            onClick={exportPlatformCsv}
          >
            {t('reports.export.csv')}
          </Button>
        </CardHeader>
        <CardContent>
          {platformTable.length === 0 && !isSalesLoading ? (
            <p className="text-sm text-muted-foreground">{t('reports.noTableData')}</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.columns.platform')}</TableHead>
                    <TableHead className="text-right">{t('reports.columns.orders')}</TableHead>
                    <TableHead className="text-right">{t('reports.kpi.revenue')}</TableHead>
                    <TableHead className="text-right">{t('reports.columns.share')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformTable.map((row) => (
                    <TableRow key={row.platform}>
                      <TableCell>{platformDisplayName(row.platform)}</TableCell>
                      <TableCell className="text-right">{row.orders}</TableCell>
                      <TableCell className="text-right">{formatTry(row.revenue)}</TableCell>
                      <TableCell className="text-right">{row.sharePct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ShareReportModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        reportId="sales"
        reportName={t('reports.tabs.sales')}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}): ReactElement {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-semibold text-primary">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
