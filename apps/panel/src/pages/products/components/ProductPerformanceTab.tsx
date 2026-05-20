import type { ReactElement } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api, getApiErrorMessage } from '@/lib/api';
import { PlatformSalesChart } from '@/pages/products/components/PlatformSalesChart';
import { StockForecastChart } from '@/pages/stock/components/StockForecastChart';
import type {
  ProductAnalyticsResponse,
  ProductStockForecastResult,
} from '@/types/product';

interface Props {
  productId: string;
}

function formatTry(value: number): string {
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

function revenueChangeLabel(pct: number | null): ReactElement {
  if (pct === null) {
    return <span className="text-muted-foreground text-xs">Karşılaştırma yok</span>;
  }
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${up ? 'text-emerald-700' : 'text-red-700'}`}
    >
      <Icon className="size-3.5" />
      {up ? '+' : ''}
      {pct.toLocaleString('tr-TR')}% geçen aya göre
    </span>
  );
}

export function ProductPerformanceTab({ productId }: Props): ReactElement {
  const analyticsQuery = useQuery({
    queryKey: ['product-analytics', productId],
    queryFn: async (): Promise<ProductAnalyticsResponse> => {
      const { data } = await api.get<ProductAnalyticsResponse>(
        `/products/${productId}/analytics`,
        { params: { days: 30 } },
      );
      return data;
    },
  });

  const forecastQuery = useQuery({
    queryKey: ['stock-forecast', 'product', productId],
    queryFn: async (): Promise<ProductStockForecastResult> => {
      const { data } = await api.get<ProductStockForecastResult>(
        `/stock/forecast/product/${productId}`,
      );
      return data;
    },
  });

  if (analyticsQuery.isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Analitik yükleniyor…
      </div>
    );
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <p className="text-destructive text-sm">
        {analyticsQuery.isError
          ? getApiErrorMessage(analyticsQuery.error)
          : 'Veri yok'}
      </p>
    );
  }

  const { dailySales, kpis, platformDistribution, priceHistory } =
    analyticsQuery.data;

  const salesChart = dailySales.map((d) => ({
    label: format(parseISO(d.date), 'd MMM', { locale: tr }),
    quantity: d.quantity,
  }));

  const priceChart = priceHistory.map((p) => ({
    label: format(parseISO(p.date), 'd MMM', { locale: tr }),
    price: p.price,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bu ay gelir</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatTry(kpis.revenueThisMonth)}
            </CardTitle>
            {revenueChangeLabel(kpis.revenueChangePct)}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Toplam satış adedi</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {kpis.totalSales.toLocaleString('tr-TR')}
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Son {analyticsQuery.data.days} gün
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ortalama sipariş değeri</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatTry(kpis.averageOrderValue)}
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              {kpis.orderCount.toLocaleString('tr-TR')} sipariş
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>İade oranı</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              %{kpis.returnRatePct.toLocaleString('tr-TR')}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son 30 gün satış trendi</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {salesChart.length === 0 ? (
            <p className="text-muted-foreground text-sm">Satış verisi yok.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="quantity"
                  name="Adet"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform dağılımı</CardTitle>
            <CardDescription>Sipariş, gelir ve iade oranı</CardDescription>
          </CardHeader>
          <CardContent>
            <PlatformSalesChart platforms={platformDistribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fiyat geçmişi</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {priceChart.length === 0 ? (
              <p className="text-muted-foreground text-sm">Fiyat geçmişi yok.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [
                      `${Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`,
                      'Fiyat',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stok tahmini</CardTitle>
          <CardDescription>
            Mevcut stok, AI projeksiyonu ve kritik seviye (30 gün)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forecastQuery.isLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Tahmin yükleniyor…
            </div>
          ) : forecastQuery.isError ? (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(forecastQuery.error)}
            </p>
          ) : forecastQuery.data ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                Mevcut:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {forecastQuery.data.currentStock.toLocaleString('tr-TR')}
                </span>
                {' · '}
                Günlük ort. satış:{' '}
                <span className="tabular-nums">
                  {forecastQuery.data.dailySalesAvg.toLocaleString('tr-TR')}
                </span>
                {forecastQuery.data.daysUntilStockout !== null ? (
                  <>
                    {' · '}
                    Tükenme: ~
                    {Math.ceil(forecastQuery.data.daysUntilStockout)} gün
                  </>
                ) : null}
              </p>
              <StockForecastChart
                data={forecastQuery.data.forecastData}
                daysUntilStockout={forecastQuery.data.daysUntilStockout}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Tahmin verisi yok.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
