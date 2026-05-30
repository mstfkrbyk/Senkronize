import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { Download, Info, Loader2, Printer, Share2, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

import { UpgradePrompt } from '@/components/UpgradePrompt';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useProducts } from '@/hooks/useProducts';
import { exportToCsv } from '@/lib/csv-export';
import { printReport } from '@/lib/pdf-export';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

import { useProfitReport } from './hooks/useReports';
import { useReportPdfDownload } from './hooks/useReportPdfDownload';
import {
  buildCostByBarcode,
  computePlatformRows,
  computeProfitBreakdown,
  computeTopProductsChart,
  hasAnyProductCost,
} from './profit-loss-calculations';
import { ShareReportModal } from './ShareReportModal';
import {
  resolveProfitReportPresentation,
  resolveReportsProductAccess,
} from './reports-tabs.config';
import {
  formatTry,
  pdfPeriodFromDates,
  periodRangeFromPreset,
  platformDisplayName,
  type PeriodPreset,
} from './report-utils';

function monthRange(offsetMonths: number): {
  startDate: string;
  endDate: string;
} {
  const anchor = subMonths(new Date(), offsetMonths);
  const start = startOfMonth(anchor);
  const end = offsetMonths === 0 ? new Date() : endOfMonth(anchor);
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  };
}

export function ProfitLossTab(): ReactElement {
  const { t } = useTranslation();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const plan = useAuthStore((s) => s.currentOrg?.plan);
  const hasProfitAccess = plan === 'PRO' || plan === 'KURUMSAL';
  const productAccess = useMemo(
    () => resolveReportsProductAccess(orgProducts),
    [orgProducts],
  );
  const { mode: accountingMode, isLoading: accountingModeLoading } =
    useAccountingMode();
  const profitPresentation = useMemo(
    () => resolveProfitReportPresentation(productAccess, accountingMode),
    [productAccess, accountingMode],
  );
  const showFullProfit = profitPresentation === 'full';
  const initial = useMemo(() => periodRangeFromPreset('30'), []);
  const [preset, setPreset] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [platform, setPlatform] = useState('all');
  const [shareOpen, setShareOpen] = useState(false);

  const thisMonth = useMemo(() => monthRange(0), []);
  const lastMonth = useMemo(() => monthRange(1), []);

  const { downloading, downloadPdf } = useReportPdfDownload();
  const reportQueriesEnabled = hasProfitAccess && showFullProfit;
  const profitQuery = useProfitReport(
    { startDate, endDate, platform: platform === 'all' ? undefined : platform },
    { enabled: reportQueriesEnabled },
  );
  const currentMonthQuery = useProfitReport(thisMonth, { enabled: reportQueriesEnabled });
  const previousMonthQuery = useProfitReport(lastMonth, { enabled: reportQueriesEnabled });
  const productsQuery = useProducts({ enabled: reportQueriesEnabled });

  const costByBarcode = useMemo(
    () => buildCostByBarcode(productsQuery.data ?? []),
    [productsQuery.data],
  );
  const usesProductCosts = useMemo(
    () => hasAnyProductCost(productsQuery.data ?? []),
    [productsQuery.data],
  );

  const breakdown = useMemo(() => {
    const data = profitQuery.data;
    if (!data) {
      return {
        revenue: 0,
        productCost: 0,
        platformCommission: 0,
        shippingCost: 0,
        netProfit: 0,
        usesProductCosts: false,
      };
    }
    return computeProfitBreakdown(
      data.totalRevenue,
      data.topProducts,
      costByBarcode,
      usesProductCosts,
      data.estimatedProfit,
    );
  }, [profitQuery.data, costByBarcode, usesProductCosts]);

  const platformRows = useMemo(() => {
    const data = profitQuery.data;
    if (!data) return [];
    return computePlatformRows(data.byPlatform, data.totalRevenue, breakdown.netProfit);
  }, [profitQuery.data, breakdown.netProfit]);

  const topProductsChart = useMemo(
    () =>
      computeTopProductsChart(
        profitQuery.data?.topProducts ?? [],
        costByBarcode,
        usesProductCosts,
      ),
    [profitQuery.data?.topProducts, costByBarcode, usesProductCosts],
  );

  const monthComparison = useMemo(() => {
    const currentData = currentMonthQuery.data;
    const previousData = previousMonthQuery.data;
    const current = currentData
      ? computeProfitBreakdown(
          currentData.totalRevenue,
          currentData.topProducts,
          costByBarcode,
          usesProductCosts,
          currentData.estimatedProfit,
        ).netProfit
      : 0;
    const previous = previousData
      ? computeProfitBreakdown(
          previousData.totalRevenue,
          previousData.topProducts,
          costByBarcode,
          usesProductCosts,
          previousData.estimatedProfit,
        ).netProfit
      : 0;
    const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
    return { current, previous, change };
  }, [
    currentMonthQuery.data,
    previousMonthQuery.data,
    costByBarcode,
    usesProductCosts,
  ]);

  function applyPreset(p: PeriodPreset): void {
    if (p === 'custom') {
      setPreset('custom');
      return;
    }
    const range = periodRangeFromPreset(p);
    setStartDate(range.start);
    setEndDate(range.end);
    setPreset(p);
  }

  if (!hasProfitAccess) {
    return (
      <UpgradePrompt
        feature={t('reports.tabs.profit')}
        requiredPlan="PRO"
        currentPlan={plan}
        description={t('reports.profit.upgradeDesc')}
      />
    );
  }

  if (accountingModeLoading && productAccess.hasAccounting) {
    return (
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    );
  }

  if (!showFullProfit) {
    return (
      <div id="report-profit" className="space-y-6">
        <Alert className="border-sky-200 bg-sky-50/80 text-sky-950">
          <Info className="h-4 w-4 text-sky-600" aria-hidden />
          <AlertTitle className="text-sky-950">
            {t('reports.profit.externalErpTitle')}
          </AlertTitle>
          <AlertDescription className="text-sky-900/90">
            <p>{t('reports.profit.externalErpDescription')}</p>
            <p className="mt-3 flex flex-wrap gap-3">
              <Link
                to="/reports?tab=erp-transfer"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {t('reports.profit.openErpTransfer')}
              </Link>
              <Link
                to="/connections?tab=erp"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {t('reports.profit.openConnections')}
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div id="report-profit" className="space-y-6">
      {profitQuery.isError ? (
        <QueryErrorAlert
          error={profitQuery.error}
          onRetry={() => {
            void profitQuery.refetch();
          }}
        />
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShareOpen(true)}>
          <Share2 className="mr-2 h-4 w-4" />
          {t('reports.share.action')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={downloading === 'profit'}
          onClick={() => void downloadPdf('profit', pdfPeriodFromDates(startDate, endDate))}
        >
          {downloading === 'profit' ? (
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
          onClick={() => printReport('report-profit', t('reports.tabs.profit'))}
        >
          <Printer className="mr-2 h-4 w-4" />
          {t('reports.export.print')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reports.filters.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['7', '7'],
                ['30', '30'],
                ['90', '90'],
                ['ytd', 'ytd'],
                ['custom', 'custom'],
              ] as const
            ).map(([key]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={preset === key ? 'default' : 'outline'}
                onClick={() => applyPreset(key)}
              >
                {key === 'ytd' ? t('reports.period.ytd') : key === 'custom' ? t('reports.period.custom') : `${key} ${t('reports.period.days')}`}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>{t('reports.period.start')}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset('custom');
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('reports.period.end')}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset('custom');
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('reports.filters.platform')}</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('reports.filters.allPlatforms')}</SelectItem>
                  <SelectItem value="TRENDYOL">Trendyol</SelectItem>
                  <SelectItem value="HEPSIBURADA">Hepsiburada</SelectItem>
                  <SelectItem value="N11">n11</SelectItem>
                  <SelectItem value="AMAZON_TR">Amazon TR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <BreakdownCard label={t('reports.kpi.revenue')} value={formatTry(breakdown.revenue)} loading={profitQuery.isLoading} />
        <BreakdownCard label={t('reports.profit.productCost')} value={formatTry(breakdown.productCost)} loading={profitQuery.isLoading} />
        <BreakdownCard label={t('reports.profit.commission')} value={formatTry(breakdown.platformCommission)} loading={profitQuery.isLoading} />
        <BreakdownCard label={t('reports.profit.shipping')} value={formatTry(breakdown.shippingCost)} loading={profitQuery.isLoading} />
        <BreakdownCard
          label={t('reports.profit.netProfit')}
          value={formatTry(breakdown.netProfit)}
          loading={profitQuery.isLoading}
          highlight
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reports.profit.monthComparison')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {currentMonthQuery.isLoading || previousMonthQuery.isLoading ? (
            <Skeleton className="h-10 w-64" />
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground">{t('reports.profit.thisMonth')}</p>
                <p className="text-xl font-semibold">{formatTry(monthComparison.current)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('reports.profit.lastMonth')}</p>
                <p className="text-xl font-semibold">{formatTry(monthComparison.previous)}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'gap-1',
                  monthComparison.change >= 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
                )}
              >
                {monthComparison.change >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {monthComparison.change >= 0 ? '+' : ''}
                {monthComparison.change.toFixed(1)}%
              </Badge>
            </>
          )}
        </CardContent>
      </Card>

      {!productsQuery.isLoading && !usesProductCosts ? (
        <Alert>
          <AlertTitle>{t('reports.profit.noCostTitle')}</AlertTitle>
          <AlertDescription>{t('reports.profit.noCostDesc')}</AlertDescription>
        </Alert>
      ) : null}

      {(profitQuery.data?.ordersWithApproximateTryConversion ?? 0) > 0 ? (
        <Alert className="border-amber-500/50 bg-amber-500/5">
          <AlertTitle>{t('reports.profit.fxWarningTitle')}</AlertTitle>
          <AlertDescription>
            {t('reports.profit.fxWarningDesc', {
              count: profitQuery.data?.ordersWithApproximateTryConversion ?? 0,
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reports.profit.topProducts')}</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          {profitQuery.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : topProductsChart.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('reports.noChartData')}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsChart} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatTry(Number(v))} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatTry(Number(v ?? 0))} />
                <Legend />
                <Bar dataKey="profit" name={t('reports.profit.netProfit')} fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{t('reports.profit.platformMargin')}</CardTitle>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={platformRows.length === 0}
            onClick={() =>
              exportToCsv(
                platformRows.map((r) => ({
                  Platform: platformDisplayName(r.platform),
                  'Gelir (TL)': r.revenue,
                  'Marj %': r.marginPct.toFixed(1),
                  'Kâr (TL)': r.profit,
                })),
                'kar-zarar-platform',
              )
            }
          >
            {t('reports.export.csv')}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reports.columns.platform')}</TableHead>
                  <TableHead className="text-right">{t('reports.kpi.revenue')}</TableHead>
                  <TableHead className="text-right">{t('reports.profit.netProfit')}</TableHead>
                  <TableHead className="text-right">{t('reports.columns.margin')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platformRows.map((r) => (
                  <TableRow key={r.platform}>
                    <TableCell>{platformDisplayName(r.platform)}</TableCell>
                    <TableCell className="text-right">{formatTry(r.revenue)}</TableCell>
                    <TableCell className="text-right text-emerald-700 dark:text-emerald-400">
                      {formatTry(r.profit)}
                    </TableCell>
                    <TableCell className="text-right">{r.marginPct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ShareReportModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        reportId="profit"
        reportName={t('reports.tabs.profit')}
      />
    </div>
  );
}

function BreakdownCard({
  label,
  value,
  loading,
  highlight = false,
}: {
  label: string;
  value: string;
  loading: boolean;
  highlight?: boolean;
}): ReactElement {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <p
            className={cn(
              'text-2xl font-semibold',
              highlight && 'text-emerald-700 dark:text-emerald-400',
            )}
          >
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
