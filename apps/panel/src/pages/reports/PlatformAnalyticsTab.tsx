import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

import {
  presetLabel,
  useAnalyticsComparison,
  type AnalyticsPeriodPreset,
} from './hooks/useAnalyticsComparison';
import { usePlatformComparison } from './hooks/useReports';
import {
  formatTry,
  platformDisplayName,
  salesPeriodRangeFromPreset,
  type SalesPeriodPreset,
} from './report-utils';

const PERIOD_MAP: Record<AnalyticsPeriodPreset, SalesPeriodPreset> = {
  month: 'month',
  quarter: '3month',
  year: 'month',
};

function normalizeScore(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((value / max) * 100);
}

export function PlatformAnalyticsTab(): ReactElement {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<AnalyticsPeriodPreset>('month');
  const { comparisonQuery, extendedMetrics, isLoading } = useAnalyticsComparison(preset);

  const range = useMemo(() => salesPeriodRangeFromPreset(PERIOD_MAP[preset]), [preset]);
  const platformQuery = usePlatformComparison(
    { startDate: range.start, endDate: range.end },
    { enabled: Boolean(range.start && range.end) },
  );

  const platforms = platformQuery.data?.platforms ?? [];

  const bestPlatform = useMemo(() => {
    if (platforms.length === 0) return null;
    return [...platforms].sort((a, b) => b.revenue - a.revenue)[0];
  }, [platforms]);

  const radarData = useMemo(() => {
    if (platforms.length === 0) return [];
    const maxOrders = Math.max(...platforms.map((p) => p.orderCount), 1);
    const maxRevenue = Math.max(...platforms.map((p) => p.revenue), 1);
    const maxAov = Math.max(...platforms.map((p) => p.avgOrderValue), 1);
    const maxReturn = Math.max(...platforms.map((p) => p.returnRate), 1) || 1;

    return platforms.map((p) => ({
      platform: platformDisplayName(p.name),
      orders: normalizeScore(p.orderCount, maxOrders),
      revenue: normalizeScore(p.revenue, maxRevenue),
      aov: normalizeScore(p.avgOrderValue, maxAov),
      returns: normalizeScore(maxReturn - p.returnRate, maxReturn),
    }));
  }, [platforms]);

  const loading = isLoading || platformQuery.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {presetLabel(preset)} · {t('reports.analytics.subtitle')}
          </p>
          {bestPlatform ? (
            <Badge className="gap-1 bg-amber-500/90 hover:bg-amber-500/90">
              <Award className="h-3 w-3" />
              {t('reports.analytics.bestPlatform', {
                platform: platformDisplayName(bestPlatform.name),
              })}
            </Badge>
          ) : null}
        </div>
        <Select
          value={preset}
          onValueChange={(v) => setPreset(v as AnalyticsPeriodPreset)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">{t('reports.period.month')}</SelectItem>
            <SelectItem value="quarter">{t('reports.analytics.quarter')}</SelectItem>
            <SelectItem value="year">{t('reports.period.ytd')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : comparisonQuery.isError || platformQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(comparisonQuery.error ?? platformQuery.error)}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {platforms.length === 0 ? (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t('reports.analytics.noPlatformData')}
                </CardContent>
              </Card>
            ) : (
              platforms.map((p) => (
                <Card key={p.name}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {platformDisplayName(p.name)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('reports.kpi.orders')}</p>
                      <p className="font-semibold tabular-nums">{p.orderCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('reports.kpi.revenue')}</p>
                      <p className="font-semibold tabular-nums">{formatTry(p.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('reports.kpi.returnRate')}</p>
                      <p className="font-semibold tabular-nums">{p.returnRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('reports.analytics.avgShipping')}</p>
                      <p className="font-semibold tabular-nums">
                        {p.syncStatus === 'healthy' ? '1-2 gün' : '—'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.analytics.radarTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {radarData.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('reports.noChartData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid className="stroke-muted" />
                    <PolarAngleAxis dataKey="platform" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Radar
                      name={t('reports.kpi.orders')}
                      dataKey="orders"
                      stroke="#0ea5e9"
                      fill="#0ea5e9"
                      fillOpacity={0.25}
                    />
                    <Radar
                      name={t('reports.kpi.revenue')}
                      dataKey="revenue"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.2}
                    />
                    <Radar
                      name={t('reports.kpi.avgOrder')}
                      dataKey="aov"
                      stroke="#f97316"
                      fill="#f97316"
                      fillOpacity={0.15}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.analytics.comparisonTable')}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.columns.platform')}</TableHead>
                    <TableHead className="text-right">{t('reports.kpi.revenue')}</TableHead>
                    <TableHead className="text-right">{t('reports.analytics.previousPeriod')}</TableHead>
                    <TableHead className="text-right">{t('reports.analytics.change')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(comparisonQuery.data?.platforms ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        {t('reports.noTableData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (comparisonQuery.data?.platforms ?? []).map((row) => (
                      <TableRow key={row.platform}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.revenue.current)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.revenue.previous)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.revenue.changeVsPrevious >= 0 ? '+' : ''}
                          {row.revenue.changeVsPrevious.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {extendedMetrics ? (
            <p className="text-xs text-muted-foreground">
              {t('reports.analytics.returnRateNote')}:{' '}
              {extendedMetrics.returnRate.current.toFixed(1)}%
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
