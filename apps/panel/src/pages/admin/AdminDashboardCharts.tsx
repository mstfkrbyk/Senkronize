import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug, ShoppingCart } from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { LazyAreaChart } from '@/components/charts/LazyAreaChart';
import {
  Card,
  CardContent,
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
import { getMarketplaceDisplay } from '@/lib/platform-display';
import type {
  AdminCohortData,
  AdminPlatformUsageItem,
} from '@/types/admin';
import type { OrgPlanTier } from '@/types/auth';

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

const PIE_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24'];

function cohortCellClass(rate: number): string {
  if (rate >= 80) {
    return 'bg-emerald-100 text-emerald-900';
  }
  if (rate >= 50) {
    return 'bg-amber-100 text-amber-900';
  }
  return 'bg-rose-100 text-rose-900';
}

function AdminChartEmpty({ message }: { message: string }): ReactElement {
  return (
    <div className="flex h-full min-h-[12rem] items-center justify-center px-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function seriesHasValues(values: number[]): boolean {
  return values.some((v) => v > 0);
}

interface Props {
  revenueChartData: { label: string; revenueTry: number }[];
  planPieData: { name: string; value: number; plan: OrgPlanTier }[];
  signupBarData: { label: string; count: number }[];
  growthChartData: {
    label: string;
    newOrganizations: number;
    activeOrganizations: number;
    mrrTry: number;
  }[];
  marketplaceUsage: AdminPlatformUsageItem[];
  erpUsage: AdminPlatformUsageItem[];
  cohortData: AdminCohortData[];
  ordersThisMonthCount: number;
  activeMarketplaceConnections: number;
}

export function AdminDashboardCharts({
  revenueChartData,
  planPieData,
  signupBarData,
  growthChartData,
  marketplaceUsage,
  erpUsage,
  cohortData,
  ordersThisMonthCount,
  activeMarketplaceConnections,
}: Props): ReactElement {
  const { t } = useTranslation();
  const maxCohortOffset = cohortData.reduce(
    (max, row) => Math.max(max, (row.retention?.length ?? 0) - 1),
    0,
  );

  const hasGrowthData = seriesHasValues([
    ...growthChartData.map((d) => d.newOrganizations),
    ...growthChartData.map((d) => d.activeOrganizations),
    ...growthChartData.map((d) => d.mrrTry),
  ]);
  const hasRevenueData = seriesHasValues(
    revenueChartData.map((d) => d.revenueTry),
  );
  const hasSignupData = seriesHasValues(signupBarData.map((d) => d.count));
  const hasMarketplaceUsage = seriesHasValues(
    marketplaceUsage.map((m) => m.count),
  );
  const hasErpUsage = seriesHasValues(erpUsage.map((e) => e.count));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t('admin.dashboard.charts.growthTrend')}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {!hasGrowthData ? (
              <AdminChartEmpty message={t('admin.dashboard.charts.growthEmpty')} />
            ) : (
            <div
              className="h-full w-full"
              role="img"
              aria-label={t('admin.dashboard.charts.growthTrend')}
            >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    `${(v as number).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                  }
                />
                <Tooltip
                  formatter={(value, name) => {
                    const v =
                      typeof value === 'number' ? value : Number(value ?? 0);
                    if (name === 'mrrTry') {
                      return [tryFormatter.format(v), t('admin.dashboard.charts.tooltipMrr')];
                    }
                    return [
                      v.toLocaleString('tr-TR'),
                      name === 'newOrganizations'
                        ? t('admin.dashboard.charts.tooltipNewSignup')
                        : t('admin.dashboard.charts.tooltipActiveOrg'),
                    ];
                  }}
                />
                <Legend
                  formatter={(value) => {
                    if (value === 'newOrganizations') {
                      return t('admin.dashboard.legend.newSignup');
                    }
                    if (value === 'activeOrganizations') {
                      return t('admin.dashboard.legend.activeOrg');
                    }
                    if (value === 'mrrTry') {
                      return t('admin.dashboard.legend.mrr');
                    }
                    return String(value);
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="newOrganizations"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="activeOrganizations"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="mrrTry"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('admin.dashboard.charts.planDistribution')}</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {planPieData.length === 0 ? (
              <AdminChartEmpty message={t('admin.dashboard.charts.planEmpty')} />
            ) : (
            <div
              className="h-full w-full"
              role="img"
              aria-label={t('admin.dashboard.charts.planDistribution')}
            >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={88}
                  label={({ name, percent }) =>
                    `${name} (${((percent as number) * 100).toFixed(0)}%)`
                  }
                >
                  {planPieData.map((entry, i) => (
                    <Cell
                      key={entry.plan}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => {
                    const n =
                      typeof value === 'number'
                        ? value
                        : Number(value ?? 0);
                    return [
                      t('admin.dashboard.charts.tooltipOrgCount', { count: n }),
                      t('admin.dashboard.charts.tooltipCount'),
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {t('admin.dashboard.charts.topMarketplaces')}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {!hasMarketplaceUsage ? (
              <AdminChartEmpty message={t('admin.dashboard.charts.marketplaceEmpty')} />
            ) : (
              <div
                className="h-full w-full"
                role="img"
                aria-label={t('admin.dashboard.charts.topMarketplaces')}
              >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={marketplaceUsage.map((m) => ({
                    label: getMarketplaceDisplay(m.key).label,
                    count: m.count,
                  }))}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={100}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(v) => [
                      `${v}`,
                      t('admin.dashboard.charts.tooltipConnection'),
                    ]}
                  />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('admin.dashboard.charts.topErp')}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {!hasErpUsage ? (
              <AdminChartEmpty message={t('admin.dashboard.charts.erpEmpty')} />
            ) : (
              <div
                className="h-full w-full"
                role="img"
                aria-label={t('admin.dashboard.charts.topErp')}
              >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={erpUsage.map((e) => ({
                    label: e.label.replace(/_/g, ' '),
                    count: e.count,
                  }))}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={100}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(v) => [
                      `${v}`,
                      t('admin.dashboard.charts.tooltipConnection'),
                    ]}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t('admin.dashboard.charts.revenue12m')}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {!hasRevenueData ? (
              <AdminChartEmpty message={t('admin.dashboard.charts.revenueEmpty')} />
            ) : (
            <div
              className="h-full w-full"
              role="img"
              aria-label={t('admin.dashboard.charts.revenue12m')}
            >
            <ResponsiveContainer width="100%" height="100%">
              <LazyAreaChart
                data={revenueChartData}
                fallback={
                  <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
                    {t('admin.dashboard.charts.revenueLoading')}
                  </div>
                }
              >
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    `${(v as number).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                  }
                />
                <Tooltip
                  formatter={(value) => {
                    const v =
                      typeof value === 'number'
                        ? value
                        : Number(value ?? 0);
                    return [tryFormatter.format(v), t('admin.dashboard.charts.tooltipRevenue')];
                  }}
                  labelFormatter={(l) => String(l)}
                />
                <Area
                  type="monotone"
                  dataKey="revenueTry"
                  stroke="#0ea5e9"
                  fillOpacity={1}
                  fill="url(#revFill)"
                  strokeWidth={2}
                />
              </LazyAreaChart>
            </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              {t('admin.dashboard.charts.dailySignups')}
            </CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShoppingCart className="size-3.5" aria-hidden />
              {t('admin.dashboard.charts.ordersThisMonth')}{' '}
              <span className="font-medium text-foreground">
                {ordersThisMonthCount.toLocaleString('tr-TR')}
              </span>
              <span className="mx-1">·</span>
              <Plug className="size-3.5" aria-hidden />
              {t('admin.dashboard.charts.activeConnections')}{' '}
              <span className="font-medium text-foreground">
                {activeMarketplaceConnections.toLocaleString('tr-TR')}
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-72">
            {!hasSignupData ? (
              <AdminChartEmpty message={t('admin.dashboard.charts.signupEmpty')} />
            ) : (
            <div
              className="h-full w-full"
              role="img"
              aria-label={t('admin.dashboard.charts.dailySignups')}
            >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signupBarData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => {
                    const n =
                      typeof value === 'number'
                        ? value
                        : Number(value ?? 0);
                    return [`${n}`, t('admin.dashboard.charts.tooltipNewOrg')];
                  }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t('admin.dashboard.charts.cohortMatrix')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {cohortData.length === 0 ? (
            <AdminChartEmpty message={t('admin.dashboard.charts.cohortEmpty')} />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>{t('admin.dashboard.charts.cohortSignupMonth')}</TableHead>
                  <TableHead className="text-right">{t('admin.dashboard.charts.cohortSize')}</TableHead>
                  {Array.from({ length: maxCohortOffset + 1 }).map((_, i) => (
                    <TableHead key={i} className="text-center">
                      {t('admin.dashboard.charts.cohortMonthOffset', { months: i })}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortData.map((row) => (
                  <TableRow key={row.cohortMonth}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {row.cohortMonth}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.cohortSize}
                    </TableCell>
                    {Array.from({ length: maxCohortOffset + 1 }).map(
                      (_, offset) => {
                        const cell = (row.retention ?? []).find(
                          (r) => r.monthOffset === offset,
                        );
                        if (!cell) {
                          return (
                            <TableCell
                              key={offset}
                              className="text-center text-muted-foreground"
                            >
                              {t('admin.common.emDash')}
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={offset} className="p-1">
                            <span
                              className={`inline-block min-w-[3rem] rounded px-2 py-1 text-center text-xs font-medium tabular-nums ${cohortCellClass(cell.rate)}`}
                            >
                              {cell.rate.toFixed(0)}%
                            </span>
                          </TableCell>
                        );
                      },
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {t('admin.dashboard.charts.cohortLegend')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
