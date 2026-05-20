import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, PieChart as PieChartIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  formatTryAmount,
  SEGMENT_CHART_COLORS,
  SEGMENT_LABELS,
} from '@/lib/customer-segments';
import { api, getApiErrorMessage } from '@/lib/api';
import type { CustomerSegmentKey, CustomerSegmentsSummary } from '@/types/customer';

const SEGMENT_ORDER: CustomerSegmentKey[] = ['VIP', 'sadik', 'yeni', 'riskAlti'];

export function CustomerSegmentsPage(): ReactElement {
  usePageTitle('Müşteri Segmentleri');

  const segmentsQuery = useQuery({
    queryKey: ['customer-segments'],
    queryFn: async (): Promise<CustomerSegmentsSummary> => {
      const { data } = await api.get<{ data: CustomerSegmentsSummary }>(
        '/customers/segments',
      );
      return data.data;
    },
  });

  const chartData = useMemo(() => {
    if (!segmentsQuery.data) {
      return [];
    }
    return SEGMENT_ORDER.map((key) => ({
      name: SEGMENT_LABELS[key],
      key,
      value: segmentsQuery.data[key].count,
      revenue: segmentsQuery.data[key].totalRevenue,
    })).filter((d) => d.value > 0);
  }, [segmentsQuery.data]);

  if (segmentsQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (segmentsQuery.isError || !segmentsQuery.data) {
    return (
      <div className="p-6">
        <EmptyState
          icon={PieChartIcon}
          title="Segment verileri yüklenemedi"
          description={getApiErrorMessage(segmentsQuery.error)}
        />
      </div>
    );
  }

  const summary = segmentsQuery.data;
  const totalCustomers = SEGMENT_ORDER.reduce(
    (sum, key) => sum + summary[key].count,
    0,
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/customers">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Müşteri Segmentleri
          </h1>
          <p className="text-sm text-muted-foreground">
            Otomatik segmentasyon: VIP, Sadık, Yeni ve Risk Altında müşteriler.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SEGMENT_ORDER.map((key) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {SEGMENT_LABELS[key]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                {summary[key].count.toLocaleString('tr-TR')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Toplam gelir: {formatTryAmount(summary[key].totalRevenue)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segment dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Henüz segmentlenecek müşteri yok.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={SEGMENT_CHART_COLORS[entry.key]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) =>
                      `${Number(v ?? 0).toLocaleString('tr-TR')} müşteri`
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Özet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Segmentler çakışabilir; bir müşteri hem VIP hem Sadık olabilir.
              Toplam segment ataması:{' '}
              <strong>{totalCustomers.toLocaleString('tr-TR')}</strong>
            </p>
            <ul className="space-y-2">
              <li>
                <strong>VIP:</strong> 10 ve üzeri sipariş
              </li>
              <li>
                <strong>Sadık:</strong> 5 ve üzeri sipariş
              </li>
              <li>
                <strong>Yeni:</strong> 2 veya daha az sipariş
              </li>
              <li>
                <strong>Risk Altında:</strong> 30 günden uzun süredir sipariş
                vermemiş (2+ sipariş geçmişi olan)
              </li>
            </ul>
            <Button asChild variant="outline">
              <Link to="/customers">Müşteri listesine dön</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
