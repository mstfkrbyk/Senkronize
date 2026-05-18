import type { ReactElement } from 'react';
import { lazy, Suspense, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CreditCard,
  HeartPulse,
  Minus,
  Sparkles,
  Users,
} from 'lucide-react';

import { PageLoader } from '@/components/PageLoader';
import { Button } from '@/components/ui/button';
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
import { api, getApiErrorMessage } from '@/lib/api';
import { getMarketplaceDisplay } from '@/lib/platform-display';
import type {
  AdminActivityItem,
  AdminHealthStats,
  AdminPlatformStats,
  AdminRevenueStats,
} from '@/types/admin';
import type { OrgPlanTier } from '@/types/auth';

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

function formatTryFromKurus(kurus: number): string {
  return tryFormatter.format(kurus / 100);
}

const PLAN_LABEL: Record<OrgPlanTier, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

const AdminDashboardCharts = lazy(async () => {
  const m = await import('@/pages/admin/AdminDashboardCharts');
  return { default: m.AdminDashboardCharts };
});

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

export function AdminDashboardPage(): ReactElement {
  const results = useQueries({
    queries: [
      {
        queryKey: ['admin', 'stats', 'platform'],
        queryFn: async (): Promise<AdminPlatformStats> => {
          const { data } = await api.get<AdminPlatformStats>(
            '/admin/stats/platform',
          );
          return data;
        },
      },
      {
        queryKey: ['admin', 'stats', 'revenue'],
        queryFn: async (): Promise<AdminRevenueStats> => {
          const { data } = await api.get<AdminRevenueStats>(
            '/admin/stats/revenue',
          );
          return data;
        },
      },
      {
        queryKey: ['admin', 'activity'],
        queryFn: async (): Promise<AdminActivityItem[]> => {
          const { data } = await api.get<AdminActivityItem[]>(
            '/admin/activity',
            { params: { limit: 10 } },
          );
          return data;
        },
      },
      {
        queryKey: ['admin', 'health'],
        queryFn: async (): Promise<AdminHealthStats> => {
          const { data } = await api.get<AdminHealthStats>('/admin/health');
          return data;
        },
      },
    ],
  });

  const [platformQ, revenueQ, activityQ, healthQ] = results;
  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);
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
    return revenueQ.data.last12MonthsRevenue.map((m) => ({
      label: format(parseISO(`${m.monthKey}-01`), 'MMM yy', { locale: tr }),
      revenueTry: m.revenueKurus / 100,
    }));
  }, [revenueQ.data]);

  const planPieData = useMemo(() => {
    if (!platformQ.data) {
      return [];
    }
    return platformQ.data.planDistribution
      .filter((p) => p.count > 0)
      .map((p) => ({
        name: PLAN_LABEL[p.plan] ?? p.plan,
        value: p.count,
        plan: p.plan,
      }));
  }, [platformQ.data]);

  const signupBarData = useMemo(() => {
    if (!platformQ.data) {
      return [];
    }
    return platformQ.data.dailyNewRegistrations.map((d) => ({
      label: format(parseISO(d.date), 'd MMM', { locale: tr }),
      count: d.count,
    }));
  }, [platformQ.data]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
        <Skeleton className="h-72 rounded-lg sm:col-span-2" />
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg sm:col-span-3" />
      </div>
    );
  }

  if (isError || !platformQ.data || !revenueQ.data || !activityQ.data || !healthQ.data) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {getApiErrorMessage(firstError)}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            refetchAll();
          }}
        >
          Tekrar dene
        </Button>
      </div>
    );
  }

  const p = platformQ.data;
  const r = revenueQ.data;

  const kpiCards: {
    title: string;
    value: string;
    sub?: string;
    icon: typeof Building2;
    tone: string;
    extra?: ReactElement;
  }[] = [
    {
      title: 'Toplam organizasyon',
      value: p.totalOrganizations.toLocaleString('tr-TR'),
      sub: `${p.activeOrganizations.toLocaleString('tr-TR')} aktif · ${p.inactiveOrganizations.toLocaleString('tr-TR')} askıda`,
      icon: Building2,
      tone: 'text-sky-600',
    },
    {
      title: 'Bu ay yeni kayıt (30 gün)',
      value: p.newRegistrationsLast30Days.toLocaleString('tr-TR'),
      sub: 'Son 30 gün içinde oluşan hesaplar',
      icon: Users,
      tone: 'text-indigo-600',
      extra: <SignupTrendIcon daily={p.dailyNewRegistrations} />,
    },
    {
      title: 'Tahmini yıllık gelir (ARR)',
      value: formatTryFromKurus(r.projectedArrKurus),
      sub: 'MRR × 12 (liste fiyatı)',
      icon: CreditCard,
      tone: 'text-emerald-600',
    },
    {
      title: 'Aylık tekrarlayan gelir (MRR)',
      value: formatTryFromKurus(r.mrrKurus),
      sub: 'Aktif abonelikler',
      icon: Sparkles,
      tone: 'text-violet-600',
    },
    {
      title: 'Aktif deneme süreci',
      value: p.trialActiveOrganizations.toLocaleString('tr-TR'),
      sub: 'Deneme aboneliği',
      icon: Activity,
      tone: 'text-amber-600',
    },
    {
      title: 'Platform sağlığı',
      value: `${p.platformHealthScore}`,
      sub: '0–100 skor (24s hata oranı)',
      icon: HeartPulse,
      tone: 'text-rose-600',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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

      <Suspense fallback={<PageLoader />}>
        <AdminDashboardCharts
          revenueChartData={revenueChartData}
          planPieData={planPieData}
          signupBarData={signupBarData}
          ordersThisMonthCount={p.ordersThisMonthCount}
          activeMarketplaceConnections={p.activeMarketplaceConnections}
        />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Son aktiviteler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 space-y-3 overflow-auto pr-1 text-sm">
              {activityQ.data.length === 0 ? (
                <p className="text-muted-foreground">Henüz kayıt yok.</p>
              ) : (
                activityQ.data.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2"
                  >
                    <p className="font-medium text-slate-900">{row.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.resourceType}
                      {row.resourceId ? ` · ${row.resourceId}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(row.createdAt), 'd MMM yyyy HH:mm', {
                        locale: tr,
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Pazaryeri sağlığı</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Bağlantı</TableHead>
                  <TableHead className="text-right">24s hata oranı</TableHead>
                  <TableHead className="text-right">Ort. süre (ms)</TableHead>
                  <TableHead>Son sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthQ.data.platforms.map((row) => {
                    const meta = getMarketplaceDisplay(row.platform);
                    return (
                      <TableRow key={row.platform}>
                        <TableCell className="font-medium">
                          <span className="mr-1" aria-hidden>
                            {meta.logo}
                          </span>
                          {meta.label}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.activeConnections}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(row.errorRate24h * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.averageSyncDurationMs != null
                            ? row.averageSyncDurationMs.toLocaleString('tr-TR')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.lastSyncAt
                            ? format(new Date(row.lastSyncAt), 'd MMM HH:mm', {
                                locale: tr,
                              })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
            {healthQ.data.platforms.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Veri bulunamadı.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
