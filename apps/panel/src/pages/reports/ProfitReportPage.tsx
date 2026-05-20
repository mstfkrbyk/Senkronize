import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Download, Loader2, Printer } from 'lucide-react';

import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { exportToCsv } from '@/lib/csv-export';
import { printReport } from '@/lib/pdf-export';
import { useAuthStore } from '@/store/auth.store';
import type { ProfitPlatformRow } from '@/types/report';
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

import { useProfitReport } from './hooks/useReports';
import { useReportPdfDownload } from './hooks/useReportPdfDownload';
import {
  formatTry,
  pdfPeriodFromDates,
  periodRangeFromPreset,
  platformDisplayName,
  type PeriodPreset,
} from './report-utils';

function splitCosts(
  revenue: number,
  totalRevenue: number,
  totalProfit: number,
): { productCost: number; shippingCost: number; vatAmount: number; profit: number } {
  if (totalRevenue <= 0) {
    return { productCost: 0, shippingCost: 0, vatAmount: 0, profit: 0 };
  }
  const share = revenue / totalRevenue;
  const profit = Math.round(totalProfit * share);
  const totalCost = revenue - profit;
  const productCost = Math.round(totalCost * 0.55);
  const shippingCost = Math.round(totalCost * 0.15);
  const vatAmount = Math.max(0, totalCost - productCost - shippingCost);
  return { productCost, shippingCost, vatAmount, profit };
}

export function ProfitReportPage(): ReactElement {
  const plan = useAuthStore((s) => s.currentOrg?.plan);
  const hasProfitAccess = plan === 'PRO' || plan === 'KURUMSAL';
  const initial = useMemo(() => periodRangeFromPreset('30'), []);
  const [preset, setPreset] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [platform, setPlatform] = useState('all');

  const { downloading, downloadPdf } = useReportPdfDownload();
  const profitQuery = useProfitReport(
    {
      startDate,
      endDate,
      platform: platform === 'all' ? undefined : platform,
    },
    { enabled: hasProfitAccess },
  );

  const platformRows = useMemo((): ProfitPlatformRow[] => {
    const data = profitQuery.data;
    if (!data) return [];
    const totalRev = data.totalRevenue || 1;
    const totalProfit = data.estimatedProfit;
    return data.byPlatform.map((row) => {
      const costs = splitCosts(row.revenue, totalRev, totalProfit);
      const marginPct =
        row.revenue > 0 ? (costs.profit / row.revenue) * 100 : 0;
      return {
        platform: row.platform,
        revenue: row.revenue,
        shippingCost: costs.shippingCost,
        vatAmount: costs.vatAmount,
        productCost: costs.productCost,
        profit: costs.profit,
        marginPct,
      };
    });
  }, [profitQuery.data]);

  const chartData = useMemo(
    () =>
      platformRows.map((r) => ({
        label: platformDisplayName(r.platform),
        Gelir: r.revenue,
        Maliyet: r.productCost + r.shippingCost + r.vatAmount,
        Kar: r.profit,
      })),
    [platformRows],
  );

  const sortedProducts = useMemo(() => {
    const items = [...(profitQuery.data?.topProducts ?? [])];
    return {
      top: [...items].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      bottom: [...items].sort((a, b) => a.revenue - b.revenue).slice(0, 5),
    };
  }, [profitQuery.data?.topProducts]);

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
        feature="Kâr / zarar raporu"
        requiredPlan="PRO"
        currentPlan={plan}
        description="Gelir, maliyet kırılımı ve kâr marjı PRO ve Kurumsal paketlerde kullanılabilir."
      />
    );
  }

  return (
    <div id="report-profit" className="space-y-6">
      {profitQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(profitQuery.error)}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
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
          PDF İndir
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => printReport('report-profit', 'Kâr zarar raporu')}
        >
          <Printer className="mr-2 h-4 w-4" />
          Yazdır / PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dönem ve platform</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['7', '7 gün'],
                ['30', '30 gün'],
                ['90', '90 gün'],
                ['ytd', 'Bu yıl'],
                ['custom', 'Özel'],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={preset === key ? 'default' : 'outline'}
                onClick={() => applyPreset(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Başlangıç</Label>
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
              <Label>Bitiş</Label>
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
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
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
            <CardTitle className="text-sm text-muted-foreground">Gelir</CardTitle>
          </CardHeader>
          <CardContent>
            {profitQuery.isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-semibold">
                {formatTry(profitQuery.data?.totalRevenue ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Kâr</CardTitle>
          </CardHeader>
          <CardContent>
            {profitQuery.isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-semibold text-emerald-700">
                {formatTry(profitQuery.data?.estimatedProfit ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Marj</CardTitle>
          </CardHeader>
          <CardContent>
            {profitQuery.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-semibold">
                {(profitQuery.data?.profitMargin ?? 0).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {(profitQuery.data?.ordersWithApproximateTryConversion ?? 0) > 0 ? (
        <Alert className="border-amber-500/50 bg-amber-500/5">
          <AlertTitle>Kur dönüşümü kısmen tahmini</AlertTitle>
          <AlertDescription>
            {profitQuery.data?.ordersWithApproximateTryConversion} sipariş için geçerli kur
            bulunamadı; maliyet ve kâr tahminidir.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gelir, maliyet ve kâr (platform)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Kargo, KDV ve ürün maliyeti toplam kâra göre oransal dağıtılır.
          </p>
        </CardHeader>
        <CardContent className="h-96">
          {profitQuery.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Veri yok.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    new Intl.NumberFormat('tr-TR', { notation: 'compact' }).format(Number(v))
                  }
                />
                <Tooltip formatter={(v) => formatTry(Number(v ?? 0))} />
                <Legend />
                <Bar dataKey="Gelir" stackId="a" fill="#0f172a" />
                <Bar dataKey="Maliyet" stackId="a" fill="#f97316" />
                <Bar dataKey="Kar" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Platform kâr tablosu</CardTitle>
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
                  'Ürün maliyeti (TL)': r.productCost,
                  'Kargo (TL)': r.shippingCost,
                  'KDV (TL)': r.vatAmount,
                  'Kâr (TL)': r.profit,
                  'Marj %': r.marginPct.toFixed(1),
                })),
                'kar-zarar-platform',
              )
            }
          >
            CSV İndir
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Gelir</TableHead>
                  <TableHead className="text-right">Maliyet</TableHead>
                  <TableHead className="text-right">Kâr</TableHead>
                  <TableHead className="text-right">Marj %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platformRows.map((r) => (
                  <TableRow key={r.platform}>
                    <TableCell>{platformDisplayName(r.platform)}</TableCell>
                    <TableCell className="text-right">{formatTry(r.revenue)}</TableCell>
                    <TableCell className="text-right">
                      {formatTry(r.productCost + r.shippingCost + r.vatAmount)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-700">
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">En kârlı ürünler</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductMiniTable rows={sortedProducts.top} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">En az kârlı ürünler</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductMiniTable rows={sortedProducts.bottom} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProductMiniTable({
  rows,
}: {
  rows: { name: string; barcode: string; revenue: number; quantity: number }[];
}): ReactElement {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Veri yok.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ürün</TableHead>
          <TableHead className="text-right">Gelir</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.barcode}>
            <TableCell className="max-w-[160px] truncate">{r.name}</TableCell>
            <TableCell className="text-right">{formatTry(r.revenue)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
