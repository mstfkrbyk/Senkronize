import type { ReactElement } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import {
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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, getApiErrorMessage } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { ProductAnalyticsResponse } from '@/types/product';

const PIE_COLORS = ['#38bdf8', '#f97316', '#22c55e', '#a855f7', '#ef4444'];

interface Props {
  productId: string;
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

  const platformChart = platformDistribution.map((p) => ({
    name: getMarketplaceBranding(p.platform).label,
    value: p.quantity,
  }));

  const priceChart = priceHistory.map((p) => ({
    label: format(parseISO(p.date), 'd MMM', { locale: tr }),
    price: p.price,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Toplam satış (30 gün)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {kpis.totalSales.toLocaleString('tr-TR')} adet
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ortalama günlük satış</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {kpis.averageDailySales.toLocaleString('tr-TR')}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>En iyi satış günü</CardDescription>
            <CardTitle className="text-lg">
              {kpis.bestDay
                ? `${format(parseISO(kpis.bestDay.date), 'd MMM yyyy', { locale: tr })} (${kpis.bestDay.quantity})`
                : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son 30 gün satış miktarı</CardTitle>
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
          </CardHeader>
          <CardContent className="h-64">
            {platformChart.length === 0 ? (
              <p className="text-muted-foreground text-sm">Veri yok.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformChart}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {platformChart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
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
    </div>
  );
}
