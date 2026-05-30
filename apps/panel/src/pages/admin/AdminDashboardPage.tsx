import type { ReactElement } from 'react';
import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CreditCard,
  HeartPulse,
  Layers,
  Loader2,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Button } from '@/components/ui/button';
import { AdminDashboardCharts } from '@/pages/admin/AdminDashboardCharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  adminAccountingModeLabel,
  adminPlanTierLabel,
  adminProductSelectionLabel,
} from '@/lib/admin-i18n-labels';
import {
  readAdminOrgProductFilterParam,
  type AdminOrgProductFilterValue,
} from '@/lib/admin-org-product-filter';
import { resolveAdminDashboardAuditHref } from '@/lib/admin-audit-nav';
import {
  formatAuditLogAction,
  formatAuditLogResourceDisplay,
} from '@/lib/audit-log-labels';
import {
  asArray,
  formatAdminHealthErrorRate,
  normalizeAdminActivityItems,
  normalizeAdminCohortData,
  normalizeAdminHealthStats,
  normalizeAdminPlatformStats,
} from '@/lib/admin-api-normalize';
import {
  formatAdminMonthKeyLabel,
  formatAdminOrgDate,
} from '@/lib/admin-org-list-normalize';
import { api } from '@/lib/api';
import { ADMIN_STATS_QUERY_OPTIONS } from '@/pages/admin/admin-dashboard-query';
import { AdminOrgProductFilterSelect } from '@/pages/admin/AdminOrgProductFilterSelect';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import { marketplacePlatformLabel } from '@/lib/platform-labels';
import type {
  AccountingModeCountEntry,
  AdminActivityItem,
  AdminCohortData,
  AdminGrowthMetrics,
  AdminHealthStats,
  AdminMrrHistoryPoint,
  AdminPlatformStats,
  AdminPlatformUsageItem,
  AdminRevenueStats,
  ProductLineCountEntry,
} from '@/types/admin';

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

function formatTryFromKurus(kurus: number): string {
  return tryFormatter.format(kurus / 100);
}

function formatDistributionSub(
  entries: { label: string; count: number }[],
  t: TFunction,
): string {
  const parts = entries
    .filter((e) => e.count > 0)
    .map((e) =>
      t('admin.dashboard.kpi.distributionEntry', {
        label: e.label,
        count: e.count.toLocaleString('tr-TR'),
      }),
    );
  return parts.length > 0 ? parts.join(' · ') : t('admin.pages.dashboard.noRecordsYet');
}

function productLineDistributionSub(
  distribution: ProductLineCountEntry[],
  t: TFunction,
): string {
  return formatDistributionSub(
    distribution.map((d) => ({
      label: adminProductSelectionLabel(d.bucket, t),
      count: d.count,
    })),
    t,
  );
}

function accountingModeDistributionSub(
  distribution: AccountingModeCountEntry[],
  t: TFunction,
): string {
  return formatDistributionSub(
    distribution.map((d) => ({
      label: adminAccountingModeLabel(d.mode, t),
      count: d.count,
    })),
    t,
  );
}

function SignupTrendIcon({
  daily,
}: {
  daily: { date: string; count: number }[];
}): ReactElement {
  const mid = Math.floor(daily.length / 2);
  const first = daily.slice(0, mid).reduce((s, d) => s + d.count, 0);
  const second = daily.slice(mid).reduce((s, d) => s + d.count, 0);
  if (second > first) {
    return <ArrowUpRight className="size-4 text-emerald-600" aria-hidden />;
  }
  if (second < first) {
    return <ArrowDownRight className="size-4 text-rose-600" aria-hidden />;
  }
  return <Minus className="size-4 text-slate-400" aria-hidden />;
}

function GrowthBadge({ value }: { value: number }): ReactElement {
  if (value > 0) {
    return (
      <span className="text-xs font-medium text-emerald-600">
        +{value.toFixed(1)}%
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="text-xs font-medium text-rose-600">
        {value.toFixed(1)}%
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">0%</span>;
}

function AdminDashboardChartsSkeleton({
  loadingLabel,
}: {
  loadingLabel: string;
}): ReactElement {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted-foreground">{loadingLabel}</p>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full rounded-md" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <Skeleton className="h-5 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-md" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <Skeleton className="h-5 w-44" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-md" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-52" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminDashboardPage(): ReactElement {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const productFilter = readAdminOrgProductFilterParam(searchParams.get('product'));
  const auditLogsHref = resolveAdminDashboardAuditHref();

  function setProductFilter(value: AdminOrgProductFilterValue): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'all') {
          next.delete('product');
        } else {
          next.set('product', value);
        }
        return next;
      },
      { replace: true },
    );
  }

  const productStatsParams =
    productFilter === 'all' ? undefined : { product: productFilter };

  const results = useQueries({
    queries: [
      {
        ...ADMIN_STATS_QUERY_OPTIONS,
        queryKey: ['admin', 'stats', 'platform', productFilter],
        queryFn: async (): Promise<AdminPlatformStats> => {
          const { data } = await api.get<AdminPlatformStats>(
            '/admin/stats/platform',
            { params: productStatsParams },
          );
          return normalizeAdminPlatformStats(data);
        },
      },
      {
        ...ADMIN_STATS_QUERY_OPTIONS,
        queryKey: ['admin', 'stats', 'revenue'],
        queryFn: async (): Promise<AdminRevenueStats> => {
          const { data } = await api.get<AdminRevenueStats>(
            '/admin/stats/revenue',
          );
          return {
            ...data,
            planRevenueDistribution: asArray(data?.planRevenueDistribution),
            last12MonthsRevenue: asArray(data?.last12MonthsRevenue),
          };
        },
      },
      {
        ...ADMIN_STATS_QUERY_OPTIONS,
        queryKey: ['admin', 'stats', 'growth', '30d'],
        queryFn: async (): Promise<AdminGrowthMetrics> => {
          const { data } = await api.get<AdminGrowthMetrics>(
            '/admin/stats/growth',
            { params: { period: '30d' } },
          );
          return data;
        },
      },
      {
        ...ADMIN_STATS_QUERY_OPTIONS,
        queryKey: ['admin', 'stats', 'mrr-history'],
        queryFn: async (): Promise<AdminMrrHistoryPoint[]> => {
          const { data } = await api.get<AdminMrrHistoryPoint[]>(
            '/admin/stats/mrr-history',
          );
          return asArray(data);
        },
      },
      {
        ...ADMIN_STATS_QUERY_OPTIONS,
        queryKey: ['admin', 'stats', 'platform-usage'],
        queryFn: async (): Promise<AdminPlatformUsageItem[]> => {
          const { data } = await api.get<AdminPlatformUsageItem[]>(
            '/admin/stats/platform-usage',
          );
          return asArray(data);
        },
      },
      {
        ...ADMIN_STATS_QUERY_OPTIONS,
        queryKey: ['admin', 'stats', 'cohort-retention'],
        queryFn: async (): Promise<AdminCohortData[]> => {
          const { data } = await api.get<AdminCohortData[]>(
            '/admin/stats/cohort-retention',
          );
          return normalizeAdminCohortData(data);
        },
      },
      {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        queryKey: ['admin', 'activity'],
        queryFn: async (): Promise<AdminActivityItem[]> => {
          const { data } = await api.get<AdminActivityItem[]>(
            '/admin/activity',
            { params: { limit: 10 } },
          );
          return normalizeAdminActivityItems(data);
        },
      },
      {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        queryKey: ['admin', 'health'],
        queryFn: async (): Promise<AdminHealthStats> => {
          const { data } = await api.get<AdminHealthStats>('/admin/health');
          return normalizeAdminHealthStats(data);
        },
      },
    ],
  });

  const [
    platformQ,
    revenueQ,
    growthQ,
    mrrHistoryQ,
    usageQ,
    cohortQ,
    activityQ,
    healthQ,
  ] = results;

  const kpiPending =
    (platformQ.isPending && !platformQ.data) ||
    (growthQ.isPending && !growthQ.data);
  const chartsPending =
    (mrrHistoryQ.isPending && !mrrHistoryQ.data) ||
    (usageQ.isPending && !usageQ.data) ||
    (cohortQ.isPending && !cohortQ.data);
  const footerLoading = activityQ.isLoading || healthQ.isLoading;

  const kpiError =
    platformQ.isError || revenueQ.isError || growthQ.isError;
  const chartsError =
    mrrHistoryQ.isError || usageQ.isError || cohortQ.isError;
  const footerError = activityQ.isError || healthQ.isError;

  const firstError = results.find((r) => r.isError)?.error;

  const refetchAll = (): void => {
    for (const r of results) {
      void r.refetch();
    }
  };

  const revenueChartData = useMemo(() => {
    if (!revenueQ.data) {
      return [];
    }
    return revenueQ.data.last12MonthsRevenue.flatMap((m) => {
      const label = formatAdminMonthKeyLabel(m.monthKey, 'MMM yy');
      if (!label) {
        return [];
      }
      return [{ label, revenueTry: m.revenueKurus / 100 }];
    });
  }, [revenueQ.data]);

  const growthChartData = useMemo(() => {
    if (!mrrHistoryQ.data) {
      return [];
    }
    return mrrHistoryQ.data.flatMap((m) => {
      const label = formatAdminMonthKeyLabel(m.monthKey, 'MMM yy');
      if (!label) {
        return [];
      }
      return [
        {
          label,
          newOrganizations: m.newOrganizations,
          activeOrganizations: m.activeOrganizations,
          mrrTry: m.mrrKurus / 100,
        },
      ];
    });
  }, [mrrHistoryQ.data]);

  const planPieData = useMemo(() => {
    if (!platformQ.data) {
      return [];
    }
    return platformQ.data.planDistribution
      .filter((p) => p.count > 0)
      .map((p) => ({
        name: adminPlanTierLabel(p.plan, t),
        value: p.count,
        plan: p.plan,
      }));
  }, [platformQ.data, t]);

  const signupBarData = useMemo(() => {
    if (!platformQ.data) {
      return [];
    }
    return platformQ.data.dailyNewRegistrations.map((d) => ({
      label: formatAdminOrgDate(d.date, 'd MMM'),
      count: d.count,
    }));
  }, [platformQ.data]);

  const marketplaceUsage = useMemo(() => {
    return (usageQ.data ?? []).filter((u) => u.type === 'marketplace');
  }, [usageQ.data]);

  const erpUsage = useMemo(() => {
    return (usageQ.data ?? []).filter((u) => u.type === 'erp');
  }, [usageQ.data]);

  const dashboardHeader = (
    <AdminPageHeader
      title={t('admin.pages.dashboard.title')}
      description={t('admin.pages.dashboard.description')}
      showBreadcrumbParent={false}
      actions={
        <AdminOrgProductFilterSelect
          value={productFilter}
          onValueChange={setProductFilter}
          className="space-y-1 sm:min-w-[180px]"
        />
      }
    />
  );

  const productFilterNote =
    productFilter !== 'all' ? (
      <p className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm text-sky-950">
        {t('admin.pages.dashboard.productFilterNote', {
          product: adminProductSelectionLabel(productFilter, t),
        })}{' '}
        <Link
          to={`/admin/organizations?product=${productFilter}`}
          className="font-medium text-sky-700 underline-offset-2 hover:underline"
        >
          {t('admin.pages.dashboard.listOrganizations')}
        </Link>
      </p>
    ) : null;

  const p = platformQ.data;
  const g = growthQ.data;
  const kpiReady = Boolean(p && g);

  const kpiCards = useMemo((): {
    title: string;
    value: string;
    sub?: string;
    icon: typeof Building2;
    tone: string;
    extra?: ReactElement;
  }[] => {
    if (!p || !g) {
      return [];
    }
    return [
    {
      title: t('admin.dashboard.kpi.totalOrganizations'),
      value: p.totalOrganizations.toLocaleString('tr-TR'),
      sub: t('admin.dashboard.kpi.totalOrganizationsSub', {
        active: p.activeOrganizations.toLocaleString('tr-TR'),
        inactive: p.inactiveOrganizations.toLocaleString('tr-TR'),
      }),
      icon: Building2,
      tone: 'text-sky-600',
    },
    {
      title: t('admin.dashboard.kpi.newSignups30d'),
      value: g.newOrganizations.toLocaleString('tr-TR'),
      sub: t('admin.dashboard.kpi.newSignups30dSub', {
        count: g.activeOrganizations.toLocaleString('tr-TR'),
      }),
      icon: Users,
      tone: 'text-indigo-600',
      extra: (
        <SignupTrendIcon daily={p.dailyNewRegistrations ?? []} />
      ),
    },
    {
      title: t('admin.dashboard.kpi.mrr'),
      value: formatTryFromKurus(g.mrrKurus),
      sub: t('admin.dashboard.kpi.mrrSub'),
      icon: Sparkles,
      tone: 'text-violet-600',
      extra: <GrowthBadge value={g.revenueGrowth} />,
    },
    {
      title: t('admin.dashboard.kpi.arr'),
      value: formatTryFromKurus(g.arrKurus),
      sub: t('admin.dashboard.kpi.arrSub'),
      icon: CreditCard,
      tone: 'text-emerald-600',
      extra: <GrowthBadge value={g.revenueGrowth} />,
    },
    {
      title: t('admin.dashboard.kpi.growth30d'),
      value: `${g.revenueGrowth >= 0 ? '+' : ''}${g.revenueGrowth.toFixed(1)}%`,
      sub: t('admin.dashboard.kpi.growth30dSub'),
      icon: Activity,
      tone: g.revenueGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600',
    },
    {
      title: t('admin.dashboard.kpi.churnRate'),
      value: `${g.churnRate.toFixed(1)}%`,
      sub: t('admin.dashboard.kpi.churnRateSub', {
        count: g.churnedOrganizations.toLocaleString('tr-TR'),
      }),
      icon: TrendingDown,
      tone: 'text-amber-600',
    },
    {
      title: t('admin.dashboard.kpi.activeTrials'),
      value: p.trialActiveOrganizations.toLocaleString('tr-TR'),
      sub: t('admin.dashboard.kpi.activeTrialsSub'),
      icon: Activity,
      tone: 'text-amber-600',
    },
    {
      title: t('admin.dashboard.kpi.productLines'),
      value: (
        p.productLineDistribution.find((d) => d.bucket === 'BUNDLE')?.count ??
        0
      ).toLocaleString('tr-TR'),
      sub: productLineDistributionSub(p.productLineDistribution, t),
      icon: Layers,
      tone: 'text-sky-700',
    },
    {
      title: t('admin.dashboard.kpi.accountingMode'),
      value: (
        p.accountingModeDistribution.find((d) => d.mode === 'NATIVE')?.count ??
        0
      ).toLocaleString('tr-TR'),
      sub: accountingModeDistributionSub(p.accountingModeDistribution, t),
      icon: Scale,
      tone: 'text-teal-700',
    },
    {
      title: t('admin.dashboard.kpi.platformHealth'),
      value: `${p.platformHealthScore}`,
      sub: t('admin.dashboard.kpi.platformHealthSub'),
      icon: HeartPulse,
      tone: 'text-rose-600',
    },
  ];
  }, [p, g, t]);

  return (
    <div className="space-y-8">
      {dashboardHeader}
      {productFilterNote}
      {kpiError && !kpiReady ? (
        <QueryErrorAlert
          error={firstError}
          onRetry={() => {
            refetchAll();
          }}
        />
      ) : null}
      {kpiPending ? (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5"
          aria-busy="true"
          aria-live="polite"
        >
          <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-4 2xl:col-span-5">
            {t('admin.pages.dashboard.loadingOverview')}
          </p>
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : kpiReady ? (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {kpiCards.map(({ title, value, sub, icon: Icon, tone, extra }) => (
          <Card key={title} className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {title}
              </CardTitle>
              <div className="flex items-center gap-1">
                {extra ?? null}
                <Icon className={`size-5 ${tone}`} aria-hidden />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-primary">
                {value}
              </p>
              {sub ? (
                <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      ) : null}

      {chartsPending ? (
        <AdminDashboardChartsSkeleton
          loadingLabel={t('admin.pages.dashboard.chartsLoading')}
        />
      ) : chartsError ||
        !mrrHistoryQ.data ||
        !usageQ.data ||
        !cohortQ.data ? (
        <QueryErrorAlert
          error={mrrHistoryQ.error ?? usageQ.error ?? cohortQ.error}
          onRetry={() => {
            void mrrHistoryQ.refetch();
            void usageQ.refetch();
            void cohortQ.refetch();
          }}
        />
      ) : (
        <AdminDashboardCharts
          revenueChartData={revenueChartData}
          planPieData={planPieData}
          signupBarData={signupBarData}
          growthChartData={growthChartData}
          marketplaceUsage={marketplaceUsage}
          erpUsage={erpUsage}
          cohortData={cohortQ.data}
          ordersThisMonthCount={p?.ordersThisMonthCount ?? 0}
          activeMarketplaceConnections={p?.activeMarketplaceConnections ?? 0}
        />
      )}

      {footerLoading ? (
        <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">
          <p className="text-sm text-muted-foreground lg:col-span-2">
            {t('admin.common.loadingActivityHealth')}
          </p>
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      ) : footerError || !activityQ.data || !healthQ.data ? (
        <QueryErrorAlert
          error={activityQ.error ?? healthQ.error}
          onRetry={() => {
            void activityQ.refetch();
            void healthQ.refetch();
          }}
        />
      ) : (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t('admin.dashboard.activity.title')}</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to={auditLogsHref}>{t('admin.dashboard.activity.viewAllAudit')}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 space-y-3 overflow-auto pr-1 text-sm">
              {activityQ.data.length === 0 ? (
                <p className="text-muted-foreground">{t('admin.common.noRecordsYetDot')}</p>
              ) : (
                activityQ.data.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2"
                  >
                    <p className="font-medium text-slate-900">
                      {formatAuditLogAction(row.action)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatAuditLogResourceDisplay(
                        row.resourceType,
                        row.resourceId,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatAdminOrgDate(row.createdAt, 'd MMM yyyy HH:mm')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t('admin.dashboard.health.title')}</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={healthQ.isFetching}
              onClick={() => {
                void healthQ.refetch();
              }}
            >
              {healthQ.isFetching ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 size-4" aria-hidden />
              )}
              {t('admin.common.refresh')}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.dashboard.health.platform')}</TableHead>
                  <TableHead className="text-right">{t('admin.dashboard.health.connections')}</TableHead>
                  <TableHead className="text-right">{t('admin.dashboard.health.errorRate24h')}</TableHead>
                  <TableHead className="text-right">{t('admin.dashboard.health.avgDurationMs')}</TableHead>
                  <TableHead>{t('admin.dashboard.health.lastSync')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthQ.data.platforms.map((row) => (
                    <TableRow key={row.platform}>
                      <TableCell className="font-medium">
                        {marketplacePlatformLabel(row.platform)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.activeConnections.toLocaleString('tr-TR')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAdminHealthErrorRate(row.errorRate24h)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.averageSyncDurationMs != null
                          ? row.averageSyncDurationMs.toLocaleString('tr-TR')
                          : t('admin.common.emDash')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatAdminOrgDate(row.lastSyncAt, 'd MMM yyyy HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            {healthQ.data.platforms.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {t('admin.common.noData')}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
