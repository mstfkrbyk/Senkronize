import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Printer } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
import { UpgradePrompt } from '@/components/UpgradePrompt';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import { exportToCsv } from '@/lib/csv-export';
import { printReport } from '@/lib/pdf-export';
import { useAuthStore } from '@/store/auth.store';
import type { ReportFilters, SalesReportData } from '@/types/report';

import { PlatformBreakdown } from './PlatformBreakdown';
import { SalesChart } from './SalesChart';
import {
  useOrderTrend,
  usePlatformComparison,
  usePlatformReport,
  useProfitReport,
  useSalesReport,
  useStockValueReport,
  useTopProducts,
} from './hooks/useReports';
import {
  aggregateSalesByGroup,
  filterSalesByDateRange,
  filterSalesByPlatform,
  summarizeSales,
} from './reportAggregation';
import { CustomReportBuilder } from './CustomReportBuilder';
import { SavedReportsList } from './SavedReportsList';

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = subDays(end, 30);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

function formatTry(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(n);
}

export function ReportsPage(): ReactElement {
  usePageTitle('Raporlar');
  const plan = useAuthStore((s) => s.currentOrg?.plan);
  const hasProfitAccess = plan === 'PRO' || plan === 'KURUMSAL';
  const initialRange = useMemo(() => defaultDateRange(), []);
  const [mainTab, setMainTab] = useState<'standard' | 'custom'>('standard');
  const [customSubTab, setCustomSubTab] = useState<'builder' | 'saved'>('builder');
  const [activeTab, setActiveTab] = useState('overview');

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [platform, setPlatform] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const [profitPreset, setProfitPreset] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [profitStart, setProfitStart] = useState(initialRange.start);
  const [profitEnd, setProfitEnd] = useState(initialRange.end);
  const [profitPlatform, setProfitPlatform] = useState<string>('all');

  const [trendStart, setTrendStart] = useState(initialRange.start);
  const [trendEnd, setTrendEnd] = useState(initialRange.end);
  const [trendGranularity, setTrendGranularity] = useState<
    'daily' | 'weekly' | 'monthly'
  >('daily');

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

  const profitQuery = useProfitReport(
    {
      startDate: profitStart,
      endDate: profitEnd,
      platform: profitPlatform,
    },
    { enabled: activeTab === 'profit' && hasProfitAccess },
  );

  const stockQuery = useStockValueReport({ enabled: activeTab === 'stock' });

  const orderTrendQuery = useOrderTrend(
    {
      startDate: trendStart,
      endDate: trendEnd,
      granularity: trendGranularity,
    },
    { enabled: activeTab === 'trend' },
  );

  const platformCompareQuery = usePlatformComparison(
    { startDate, endDate },
    { enabled: activeTab === 'platform' },
  );

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

  const profitPieSlices = useMemo(() => {
    const rows = profitQuery.data?.byPlatform ?? [];
    return rows.map((r) => ({
      name: r.platform,
      value: r.revenue,
    }));
  }, [profitQuery.data?.byPlatform]);

  const orderTrendChartData = useMemo(() => {
    const d = orderTrendQuery.data;
    if (!d) {
      return [];
    }
    return d.labels.map((label, i) => ({
      label,
      orderCount: d.orderCounts[i] ?? 0,
      revenue: d.revenues[i] ?? 0,
    }));
  }, [orderTrendQuery.data]);

  const summary = useMemo(() => summarizeSales(chartRows), [chartRows]);

  const showSampleBanner = salesQuery.data?.kind === 'mock';
  const isSalesLoading = salesQuery.isFetching && salesQuery.data?.kind === 'placeholder';

  function applyProfitPreset(preset: '7' | '30' | '90'): void {
    const end = new Date();
    const daysBack = preset === '7' ? 6 : preset === '30' ? 29 : 89;
    const start = subDays(end, daysBack);
    setProfitStart(format(start, 'yyyy-MM-dd'));
    setProfitEnd(format(end, 'yyyy-MM-dd'));
    setProfitPreset(preset);
  }

  function exportSalesTable(): void {
    if (chartRows.length === 0) {
      return;
    }
    exportToCsv(
      chartRows.map((d: SalesReportData) => ({
        Tarih: d.period,
        'Sipariş sayısı': d.totalOrders,
        'Gelir (TL)': d.totalRevenue,
      })),
      'satis-raporu',
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Raporlar</h1>
          <p className="text-muted-foreground">
            Satış, kâr, stok değeri ve platform performansını tek ekrandan inceleyin.
          </p>
        </div>
      </div>

      {showSampleBanner ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Rapor sunucusuna ulaşılamadı; grafikler örnek veri ile gösteriliyor.
        </div>
      ) : null}

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'standard' | 'custom')} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="standard">Standart raporlar</TabsTrigger>
          <TabsTrigger value="custom">Özel raporlar</TabsTrigger>
        </TabsList>

        <TabsContent value="custom" className="space-y-4">
          <Tabs value={customSubTab} onValueChange={(v) => setCustomSubTab(v as 'builder' | 'saved')} className="space-y-4">
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="builder">Rapor oluşturucu</TabsTrigger>
              <TabsTrigger value="saved">Kayıtlı raporlar</TabsTrigger>
            </TabsList>
            <TabsContent value="builder">
              <CustomReportBuilder />
            </TabsContent>
            <TabsContent value="saved">
              <SavedReportsList />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="standard" className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">Satış özeti</TabsTrigger>
          <TabsTrigger value="profit">Kâr analizi</TabsTrigger>
          <TabsTrigger value="stock">Stok değeri</TabsTrigger>
          <TabsTrigger value="trend">Sipariş trendi</TabsTrigger>
          <TabsTrigger value="platform">Platform karşılaştırma</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div id="report-content" className="space-y-6">
          {salesQuery.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {getApiErrorMessage(salesQuery.error)}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => printReport('report-content', 'Satış özeti raporu')}
            >
              <Printer className="mr-2 h-4 w-4" />
              Yazdır / PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={chartRows.length === 0}
              onClick={exportSalesTable}
            >
              CSV İndir (grafik)
            </Button>
          </div>

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
                <Label htmlFor="rep-platform">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="rep-platform">
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="TRENDYOL">Trendyol</SelectItem>
                    <SelectItem value="HEPSIBURADA">Hepsiburada</SelectItem>
                    <SelectItem value="N11">n11</SelectItem>
                    <SelectItem value="AMAZON_TR">Amazon TR</SelectItem>
                  </SelectContent>
                </Select>
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
                    {formatTry(summary.totalRevenue)}
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
                    {formatTry(summary.averageOrderValue)}
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
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">En çok satan ürünler</CardTitle>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={(topProductsQuery.data ?? []).length === 0}
                onClick={() =>
                  exportToCsv(
                    (topProductsQuery.data ?? []).map((row) => ({
                      Barkod: row.barcode,
                      Adet: row.totalQuantity,
                      'Sipariş sayısı': row.orderCount,
                    })),
                    'en-cok-satan-urunler',
                  )
                }
              >
                CSV İndir
              </Button>
            </CardHeader>
            <CardContent>
              {topProductsQuery.isError ? (
                <p className="text-sm text-destructive">
                  {getApiErrorMessage(topProductsQuery.error)}
                </p>
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
                  <Table aria-label="En çok satan ürünler">
                    <TableCaption className="sr-only">En çok satan ürünler tablosu</TableCaption>
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
        </TabsContent>

        <TabsContent value="profit">
          {!hasProfitAccess ? (
            <UpgradePrompt
              feature="Kâr raporu ve kâr analizi"
              requiredPlan="PRO"
              currentPlan={plan}
              description="Platform bazlı kâr dağılımı ve detaylı kâr analizi PRO ve Kurumsal paketlerde kullanılabilir."
            />
          ) : (
          <div id="report-content" className="space-y-6">
          {profitQuery.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {getApiErrorMessage(profitQuery.error)}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => printReport('report-content', 'Kâr analizi raporu')}
            >
              <Printer className="mr-2 h-4 w-4" />
              Yazdır / PDF
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tarih aralığı</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={profitPreset === '7' ? 'default' : 'outline'}
                  onClick={() => applyProfitPreset('7')}
                >
                  Son 7 gün
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={profitPreset === '30' ? 'default' : 'outline'}
                  onClick={() => applyProfitPreset('30')}
                >
                  Son 30 gün
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={profitPreset === '90' ? 'default' : 'outline'}
                  onClick={() => applyProfitPreset('90')}
                >
                  Son 90 gün
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={profitPreset === 'custom' ? 'default' : 'outline'}
                  onClick={() => setProfitPreset('custom')}
                >
                  Özel
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="profit-start">Başlangıç</Label>
                  <Input
                    id="profit-start"
                    type="date"
                    value={profitStart}
                    onChange={(e) => {
                      setProfitStart(e.target.value);
                      setProfitPreset('custom');
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profit-end">Bitiş</Label>
                  <Input
                    id="profit-end"
                    type="date"
                    value={profitEnd}
                    onChange={(e) => {
                      setProfitEnd(e.target.value);
                      setProfitPreset('custom');
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profit-platform">Platform</Label>
                  <Select
                    value={profitPlatform}
                    onValueChange={(v) => {
                      setProfitPlatform(v);
                    }}
                  >
                    <SelectTrigger id="profit-platform">
                      <SelectValue placeholder="Tümü" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü</SelectItem>
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

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Toplam gelir
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profitQuery.isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <p className="text-2xl font-semibold text-primary">
                    {formatTry(profitQuery.data?.totalRevenue ?? 0)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tahmini kâr
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profitQuery.isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <p className="text-2xl font-semibold text-primary">
                    {formatTry(profitQuery.data?.estimatedProfit ?? 0)}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Maliyet verisi yoksa gelirin %20&apos;si varsayılır.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Kâr marjı
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profitQuery.isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-semibold text-primary">
                    {(profitQuery.data?.profitMargin ?? 0).toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {profitQuery.isLoading ? (
              <Card>
                <CardContent className="h-72 pt-6">
                  <Skeleton className="h-full w-full rounded-md" />
                </CardContent>
              </Card>
            ) : (
              <PlatformBreakdown data={profitPieSlices} />
            )}
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">En çok satan 10 ürün (gelir)</CardTitle>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={(profitQuery.data?.topProducts ?? []).length === 0}
                  onClick={() =>
                    exportToCsv(
                      (profitQuery.data?.topProducts ?? []).map((row) => ({
                        Ürün: row.name,
                        Barkod: row.barcode,
                        'Gelir (TL)': row.revenue,
                        Adet: row.quantity,
                      })),
                      'kar-raporu-urunler',
                    )
                  }
                >
                  CSV İndir
                </Button>
              </CardHeader>
              <CardContent>
                {(profitQuery.data?.topProducts ?? []).length === 0 && !profitQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Bu aralıkta satır bulunamadı.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table aria-label="Kâr raporu en çok satan ürünler">
                      <TableCaption className="sr-only">
                        Kâr analizi en çok satan ürünler tablosu
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ürün</TableHead>
                          <TableHead>Barkod</TableHead>
                          <TableHead className="text-right">Gelir</TableHead>
                          <TableHead className="text-right">Adet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(profitQuery.data?.topProducts ?? []).map((row) => (
                          <TableRow key={row.barcode}>
                            <TableCell className="max-w-[180px] truncate">{row.name}</TableCell>
                            <TableCell className="font-mono text-sm">{row.barcode}</TableCell>
                            <TableCell className="text-right">{formatTry(row.revenue)}</TableCell>
                            <TableCell className="text-right">{row.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
          )}
        </TabsContent>

        <TabsContent value="stock">
          <div id="report-content" className="space-y-6">
          {stockQuery.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {getApiErrorMessage(stockQuery.error)}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Toplam stok değeri (satış fiyatı × adet)</p>
              {stockQuery.isLoading ? (
                <Skeleton className="mt-2 h-12 w-48" />
              ) : (
                <p className="text-3xl font-semibold tracking-tight text-primary">
                  {formatTry(stockQuery.data?.totalStockValue ?? 0)}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => printReport('report-content', 'Stok değeri raporu')}
              >
                <Printer className="mr-2 h-4 w-4" />
                Yazdır / PDF
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={(stockQuery.data?.byPlatform ?? []).length === 0}
                onClick={() =>
                  exportToCsv(
                    (stockQuery.data?.byPlatform ?? []).map((row) => ({
                      Platform: row.platform,
                      'Stok değeri (TL)': row.totalValue,
                      'SKU sayısı': row.skuCount,
                    })),
                    'stok-degeri-platform',
                  )
                }
              >
                CSV İndir
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ürün (barkod) sayısı
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stockQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-semibold">{stockQuery.data?.totalProducts ?? 0}</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-destructive">Stokta yok</CardTitle>
              </CardHeader>
              <CardContent>
                {stockQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-semibold text-destructive">
                    {stockQuery.data?.outOfStockCount ?? 0}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-900">Düşük stok (1–5)</CardTitle>
              </CardHeader>
              <CardContent>
                {stockQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-semibold text-amber-900">
                    {stockQuery.data?.lowStockCount ?? 0}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Platform bazlı stok değeri</CardTitle>
              <Badge variant="secondary">SKU: {stockQuery.data?.totalSkus ?? '—'}</Badge>
            </CardHeader>
            <CardContent>
              {stockQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (stockQuery.data?.byPlatform ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Listeleme kaydı yok.</p>
              ) : (
                <div className="rounded-md border">
                  <Table aria-label="Platform bazlı stok değeri">
                    <TableCaption className="sr-only">
                      Platform bazlı stok değeri tablosu
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">SKU</TableHead>
                        <TableHead className="text-right">Değer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stockQuery.data?.byPlatform ?? []).map((row) => (
                        <TableRow key={row.platform}>
                          <TableCell>{row.platform}</TableCell>
                          <TableCell className="text-right">{row.skuCount}</TableCell>
                          <TableCell className="text-right">{formatTry(row.totalValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </TabsContent>

        <TabsContent value="trend">
          <div id="report-content" className="space-y-6">
          {orderTrendQuery.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {getApiErrorMessage(orderTrendQuery.error)}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => printReport('report-content', 'Sipariş trendi raporu')}
            >
              <Printer className="mr-2 h-4 w-4" />
              Yazdır / PDF
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtreler</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="trend-start">Başlangıç</Label>
                <Input
                  id="trend-start"
                  type="date"
                  value={trendStart}
                  onChange={(e) => setTrendStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trend-end">Bitiş</Label>
                <Input
                  id="trend-end"
                  type="date"
                  value={trendEnd}
                  onChange={(e) => setTrendEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trend-granularity">Granülarite</Label>
                <Select
                  value={trendGranularity}
                  onValueChange={(v) =>
                    setTrendGranularity(v as 'daily' | 'weekly' | 'monthly')
                  }
                >
                  <SelectTrigger id="trend-granularity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Günlük</SelectItem>
                    <SelectItem value="weekly">Haftalık</SelectItem>
                    <SelectItem value="monthly">Aylık</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sipariş ve gelir trendi</CardTitle>
            </CardHeader>
            <CardContent className="h-96">
              {orderTrendQuery.isLoading ? (
                <Skeleton className="h-full w-full rounded-md" />
              ) : orderTrendChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu aralıkta veri yok.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={orderTrendChartData}
                    margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="orders"
                      orientation="left"
                      tick={{ fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      yAxisId="revenue"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        new Intl.NumberFormat('tr-TR', {
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        }).format(Number(v))
                      }
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const v = value == null ? 0 : Number(value);
                        if (name === 'revenue') {
                          return [formatTry(v), 'Gelir'];
                        }
                        return [v, 'Sipariş'];
                      }}
                    />
                    <Legend
                      formatter={(value) =>
                        value === 'revenue' ? 'Gelir (₺)' : 'Sipariş adedi'
                      }
                    />
                    <Line
                      yAxisId="orders"
                      type="monotone"
                      dataKey="orderCount"
                      name="orderCount"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="revenue"
                      type="monotone"
                      dataKey="revenue"
                      name="revenue"
                      stroke="#0f172a"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={orderTrendChartData.length === 0}
              onClick={() =>
                exportToCsv(
                  orderTrendChartData.map((row) => ({
                    Dönem: row.label,
                    'Sipariş adedi': row.orderCount,
                    'Gelir (TL)': row.revenue,
                  })),
                  'siparis-trendi',
                )
              }
            >
              CSV İndir
            </Button>
          </div>
        </div>
        </TabsContent>

        <TabsContent value="platform">
          <div id="report-content" className="space-y-6">
          {platformCompareQuery.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {getApiErrorMessage(platformCompareQuery.error)}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => printReport('report-content', 'Platform karşılaştırma raporu')}
            >
              <Printer className="mr-2 h-4 w-4" />
              Yazdır / PDF
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Tarih aralığı için üstteki Satış özeti sekmesindeki başlangıç ve bitiş tarihlerini kullanır.
          </p>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Platform performansı</CardTitle>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={(platformCompareQuery.data?.platforms ?? []).length === 0}
                onClick={() =>
                  exportToCsv(
                    (platformCompareQuery.data?.platforms ?? []).map((row) => ({
                      Platform: row.name,
                      'Sipariş (iptal hariç)': row.orderCount,
                      'Gelir (TL)': row.revenue,
                      'Ort. sepet (TL)': row.avgOrderValue,
                      'İptal/iade oranı (%)': row.returnRate.toFixed(2),
                      'Senkron durumu': row.syncStatus,
                    })),
                    'platform-karsilastirma',
                  )
                }
              >
                CSV İndir
              </Button>
            </CardHeader>
            <CardContent>
              {platformCompareQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (platformCompareQuery.data?.platforms ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Veri bulunamadı.</p>
              ) : (
                <div className="rounded-md border">
                  <Table aria-label="Platform performans karşılaştırması">
                    <TableCaption className="sr-only">
                      Platform performans karşılaştırması tablosu
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">Sipariş</TableHead>
                        <TableHead className="text-right">Gelir</TableHead>
                        <TableHead className="text-right">Ort. sepet</TableHead>
                        <TableHead className="text-right">İptal/iade %</TableHead>
                        <TableHead>Senkron</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(platformCompareQuery.data?.platforms ?? []).map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right">{row.orderCount}</TableCell>
                          <TableCell className="text-right">{formatTry(row.revenue)}</TableCell>
                          <TableCell className="text-right">{formatTry(row.avgOrderValue)}</TableCell>
                          <TableCell className="text-right">
                            {row.returnRate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-sm">{row.syncStatus}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </TabsContent>
      </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
