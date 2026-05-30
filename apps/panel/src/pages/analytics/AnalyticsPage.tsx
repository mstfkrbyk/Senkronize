import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/PageHeader';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/store/auth.store';
import type { PlatformComparisonRow } from '@/types/analytics';

import { formatAnalyticsNavContext } from './analytics-nav-context';
import {
  useAovTrend,
  useCustomerInsights,
  useDailyRevenueTrend,
  usePlatformComparison,
  useRevenueByHour,
  useTopProducts,
  useTopReturnedProducts,
} from './hooks/useOrderAnalytics';

const PERIOD = '30d';
const CHART_COLORS = ['#0ea5e9', '#0f172a', '#22c55e', '#f97316', '#a855f7'];
const PIE_COLORS = ['#0ea5e9', '#94a3b8'];
const CHART_EMPTY_CLASS =
  'flex h-full min-h-48 items-center justify-center py-8 text-center text-sm text-muted-foreground';

function formatTry(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n}%`;
}

function growthClass(n: number): string {
  if (n > 0) {
    return 'text-emerald-600';
  }
  if (n < 0) {
    return 'text-red-600';
  }
  return 'text-muted-foreground';
}

function scorePlatform(p: PlatformComparisonRow, max: {
  revenue: number;
  orders: number;
  growth: number;
}): Record<string, number> {
  return {
    Gelir: Math.round((p.revenue / max.revenue) * 100),
    Büyüme: Math.round(((p.growthPct + max.growth) / (2 * max.growth)) * 100),
    İade: Math.max(0, Math.round(100 - p.returnRate * 2)),
    BuyBox: Math.round(p.buyBoxWinRate),
    Hız: Math.min(100, Math.round((p.orderCount / max.orders) * 100)),
  };
}

function buildRadarSeries(platforms: PlatformComparisonRow[]): {
  data: Array<Record<string, string | number>>;
  platformLabels: string[];
} {
  const top = platforms.slice(0, 4);
  if (top.length === 0) {
    return { data: [], platformLabels: [] };
  }
  const max = {
    revenue: Math.max(...top.map((p) => p.revenue), 1),
    orders: Math.max(...top.map((p) => p.orderCount), 1),
    growth: Math.max(...top.map((p) => Math.abs(p.growthPct)), 1),
  };
  const metrics = ['Gelir', 'Büyüme', 'İade', 'BuyBox', 'Hız'] as const;
  const platformLabels = top.map((p) => p.label);
  const scoresByPlatform = top.map((p) => scorePlatform(p, max));

  const data = metrics.map((metric) => {
    const row: Record<string, string | number> = { metric };
    platformLabels.forEach((label, i) => {
      row[label] = scoresByPlatform[i]?.[metric] ?? 0;
    });
    return row;
  });

  return { data, platformLabels };
}

function ChartSkeleton(): ReactElement {
  return <Skeleton className="h-64 w-full" />;
}

export function AnalyticsPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const pageTitle = t('nav.analytics');
  const navContextLine = formatAnalyticsNavContext(
    groupLabel,
    pageTitle,
    orgProducts,
    t,
  );

  usePageTitle(pageTitle);
  const [tab, setTab] = useState('platform');

  const platformQuery = usePlatformComparison(PERIOD);
  const customerQuery = useCustomerInsights(PERIOD);
  const aovQuery = useAovTrend(90);
  const topProductsQuery = useTopProducts(PERIOD, 10);
  const topReturnedQuery = useTopReturnedProducts(PERIOD, 10);
  const hourlyQuery = useRevenueByHour(30);
  const dailyQuery = useDailyRevenueTrend(30);

  const platforms = useMemo(
    () => platformQuery.data?.platforms ?? [],
    [platformQuery.data?.platforms],
  );
  const revenueChartData = useMemo(
    () =>
      platforms.map((p) => ({
        name: p.label,
        gelir: p.revenue,
      })),
    [platforms],
  );
  const radarSeries = useMemo(() => buildRadarSeries(platforms), [platforms]);

  const repeatPieData = useMemo(() => {
    const rate = customerQuery.data?.repeatCustomerRate ?? 0;
    return [
      { name: 'Tekrar eden', value: rate },
      { name: 'Tek seferlik', value: Math.max(0, 100 - rate) },
    ];
  }, [customerQuery.data?.repeatCustomerRate]);

  const topProductChart = useMemo(
    () =>
      (topProductsQuery.data?.products ?? []).map((p) => ({
        name: (p.productName ?? p.barcode).slice(0, 28),
        adet: p.quantity,
      })),
    [topProductsQuery.data?.products],
  );

  const hourlyChart = useMemo(
    () =>
      (hourlyQuery.data?.hours ?? []).map((h) => ({
        saat: h.label,
        gelir: h.revenue,
      })),
    [hourlyQuery.data?.hours],
  );

  const dailyChart = useMemo(
    () =>
      (dailyQuery.data?.points ?? []).map((p) => ({
        label: p.label,
        gelir: p.revenue,
      })),
    [dailyQuery.data?.points],
  );

  const aovChart = useMemo(
    () =>
      (aovQuery.data?.points ?? []).map((p) => ({
        label: p.label,
        aov: p.aov,
      })),
    [aovQuery.data?.points],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description="Platform, müşteri, ürün ve gelir performansını tek ekranda inceleyin."
        context={navContextLine}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="platform">Platform Karşılaştırma</TabsTrigger>
          <TabsTrigger value="customer">Müşteri Analizi</TabsTrigger>
          <TabsTrigger value="products">Ürün Performansı</TabsTrigger>
          <TabsTrigger value="revenue">Gelir Analizi</TabsTrigger>
        </TabsList>

        <TabsContent value="platform" className="mt-4 space-y-4">
          {platformQuery.isError ? (
            <QueryErrorAlert error={platformQuery.error} />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Platform bazlı gelir</CardTitle>
                <CardDescription>Son {PERIOD} dönemi</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {platformQuery.isPending ? (
                  <ChartSkeleton />
                ) : revenueChartData.length === 0 ? (
                  <div className={CHART_EMPTY_CLASS}>Henüz sipariş verisi yok.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChartData} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tickFormatter={(v: number) => formatTry(v)} />
                      <Tooltip formatter={(v) => formatTry(Number(v ?? 0))} />
                      <Bar dataKey="gelir" name="Gelir" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Platform puanlaması</CardTitle>
                <CardDescription>Gelir, büyüme, iade, BuyBox ve hacim (0–100)</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {platformQuery.isPending ? (
                  <ChartSkeleton />
                ) : radarSeries.data.length === 0 ? (
                  <div className={CHART_EMPTY_CLASS}>Karşılaştırma verisi yok.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarSeries.data}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                      {radarSeries.platformLabels.map((label, i) => (
                        <Radar
                          key={label}
                          name={label}
                          dataKey={label}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          fillOpacity={0.12}
                        />
                      ))}
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Platform özeti</CardTitle>
              <CardDescription>Sipariş, gelir, sepet, iade ve büyüme</CardDescription>
            </CardHeader>
            <CardContent>
              {platformQuery.isPending ? (
                <ChartSkeleton />
              ) : platforms.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Henüz veri yok.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Sipariş</TableHead>
                      <TableHead className="text-right">Gelir</TableHead>
                      <TableHead className="text-right">Ort. sepet</TableHead>
                      <TableHead className="text-right">İade %</TableHead>
                      <TableHead className="text-right">BuyBox %</TableHead>
                      <TableHead className="text-right">Büyüme</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {platforms.map((row) => (
                      <TableRow key={row.platform}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right">
                          {row.orderCount.toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-right">{formatTry(row.revenue)}</TableCell>
                        <TableCell className="text-right">
                          {formatTry(row.avgBasket)}
                        </TableCell>
                        <TableCell className="text-right">%{row.returnRate}</TableCell>
                        <TableCell className="text-right">%{row.buyBoxWinRate}</TableCell>
                        <TableCell className={`text-right ${growthClass(row.growthPct)}`}>
                          {formatPct(row.growthPct)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer" className="mt-4 space-y-4">
          {customerQuery.isError ? (
            <QueryErrorAlert error={customerQuery.error} />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tekrar müşteri oranı</CardTitle>
                <CardDescription>
                  {customerQuery.data
                    ? `${customerQuery.data.repeatCustomers} / ${customerQuery.data.totalCustomers} müşteri`
                    : 'Son 30 gün'}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {customerQuery.isPending ? (
                  <ChartSkeleton />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={repeatPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {repeatPieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `%${Number(v ?? 0)}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ortalama sipariş değeri</CardTitle>
                <CardDescription>Dönem ortalaması</CardDescription>
              </CardHeader>
              <CardContent className="flex h-64 items-center justify-center">
                {customerQuery.isPending ? (
                  <ChartSkeleton />
                ) : (
                  <p className="text-3xl font-semibold text-foreground">
                    {formatTry(customerQuery.data?.avgOrderValue ?? 0)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Şehir bazlı dağılım</CardTitle>
              <CardDescription>En çok sipariş veren şehirler</CardDescription>
            </CardHeader>
            <CardContent>
              {customerQuery.isPending ? (
                <ChartSkeleton />
              ) : (customerQuery.data?.topCities.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Şehir verisi bulunamadı.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Şehir</TableHead>
                      <TableHead className="text-right">Sipariş</TableHead>
                      <TableHead className="text-right">Gelir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerQuery.data?.topCities.map((row) => (
                      <TableRow key={row.city}>
                        <TableCell>{row.city}</TableCell>
                        <TableCell className="text-right">{row.orderCount}</TableCell>
                        <TableCell className="text-right">{formatTry(row.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AOV trendi</CardTitle>
              <CardDescription>Son 90 gün ortalama sepet değeri</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {aovQuery.isError ? (
                <QueryErrorAlert error={aovQuery.error} />
              ) : aovQuery.isPending ? (
                <ChartSkeleton />
              ) : aovChart.length === 0 ? (
                <div className={CHART_EMPTY_CLASS}>Trend verisi yok.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aovChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tickFormatter={(v: number) => formatTry(v)} />
                    <Tooltip formatter={(v) => formatTry(Number(v ?? 0))} />
                    <Line
                      type="monotone"
                      dataKey="aov"
                      name="AOV"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>En çok satan ürünler</CardTitle>
              <CardDescription>Top 10 — miktar bazlı</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {topProductsQuery.isError ? (
                <QueryErrorAlert error={topProductsQuery.error} />
              ) : topProductsQuery.isPending ? (
                <ChartSkeleton />
              ) : topProductChart.length === 0 ? (
                <div className={CHART_EMPTY_CLASS}>Ürün verisi yok.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductChart} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="adet" name="Adet" fill="#0f172a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>En çok iade edilen ürünler</CardTitle>
              <CardDescription>Son 30 gün</CardDescription>
            </CardHeader>
            <CardContent>
              {topReturnedQuery.isError ? (
                <QueryErrorAlert error={topReturnedQuery.error} />
              ) : topReturnedQuery.isPending ? (
                <ChartSkeleton />
              ) : (topReturnedQuery.data?.products.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  İade kaydı bulunamadı.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barkod</TableHead>
                      <TableHead className="text-right">İade sayısı</TableHead>
                      <TableHead className="text-right">Adet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topReturnedQuery.data?.products.map((row) => (
                      <TableRow key={row.barcode}>
                        <TableCell className="font-mono text-sm">{row.barcode}</TableCell>
                        <TableCell className="text-right">{row.returnCount}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Saatlik satış dağılımı</CardTitle>
                <CardDescription>Hangi saat en çok satış yapılıyor</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {hourlyQuery.isError ? (
                  <QueryErrorAlert error={hourlyQuery.error} />
                ) : hourlyQuery.isPending ? (
                  <ChartSkeleton />
                ) : hourlyChart.length === 0 ? (
                  <div className={CHART_EMPTY_CLASS}>Saatlik veri yok.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="saat" tick={{ fontSize: 9 }} interval={2} />
                      <YAxis tickFormatter={(v: number) => formatTry(v)} />
                      <Tooltip formatter={(v) => formatTry(Number(v ?? 0))} />
                      <Bar dataKey="gelir" name="Gelir" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Günlük gelir trendi</CardTitle>
                <CardDescription>Son 30 gün</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {dailyQuery.isError ? (
                  <QueryErrorAlert error={dailyQuery.error} />
                ) : dailyQuery.isPending ? (
                  <ChartSkeleton />
                ) : dailyChart.length === 0 ? (
                  <div className={CHART_EMPTY_CLASS}>Günlük veri yok.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tickFormatter={(v: number) => formatTry(v)} />
                      <Tooltip formatter={(v) => formatTry(Number(v ?? 0))} />
                      <Area
                        type="monotone"
                        dataKey="gelir"
                        name="Gelir"
                        stroke="#0ea5e9"
                        fill="hsl(199 89% 48% / 0.15)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

