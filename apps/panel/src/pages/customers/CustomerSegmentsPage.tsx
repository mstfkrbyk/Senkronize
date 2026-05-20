import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, PieChart as PieChartIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  formatTryAmount,
  SEGMENT_BADGE_CLASS,
  SEGMENT_CHART_COLORS,
  SEGMENT_CRITERIA,
  SEGMENT_LABELS,
} from '@/lib/customer-segments';
import { api, getApiErrorMessage } from '@/lib/api';
import type { CustomerSegmentKey, CustomerSegmentsSummary } from '@/types/customer';

const SEGMENT_ORDER: CustomerSegmentKey[] = [
  'VIP',
  'sadik',
  'yeni',
  'risk',
  'kayip',
];

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
      revenue: Number(segmentsQuery.data[key].totalRevenue),
    })).filter((d) => d.value > 0);
  }, [segmentsQuery.data]);

  const handleEmailPlaceholder = (segment: CustomerSegmentKey): void => {
    toast.info(
      `${SEGMENT_LABELS[segment]} segmentine e-posta gönderimi yakında eklenecek.`,
    );
  };

  if (segmentsQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
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
  const totalAssignments = SEGMENT_ORDER.reduce(
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
            Otomatik segmentasyon: harcama, sipariş sıklığı ve son aktiviteye göre.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {SEGMENT_ORDER.map((key) => {
          const stats = summary[key];
          const avgSpend =
            stats.count > 0
              ? Number(stats.totalRevenue) / stats.count
              : 0;
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Badge variant="outline" className={SEGMENT_BADGE_CLASS[key]}>
                    {SEGMENT_LABELS[key]}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{SEGMENT_CRITERIA[key]}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-semibold tabular-nums">
                  {stats.count.toLocaleString('tr-TR')}
                </p>
                <p className="text-sm text-muted-foreground">
                  Ort. harcama: {formatTryAmount(avgSpend)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleEmailPlaceholder(key)}
                >
                  <Mail className="mr-2 size-4" />
                  Bu segmente e-posta gönder
                </Button>
              </CardContent>
            </Card>
          );
        })}
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
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
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
                    formatter={(v, _name, item) => {
                      const payload = item?.payload as {
                        revenue?: number;
                      } | undefined;
                      const count = Number(v ?? 0);
                      const rev = payload?.revenue ?? 0;
                      return [
                        `${count.toLocaleString('tr-TR')} müşteri · ${formatTryAmount(rev)} gelir`,
                        String(item?.name ?? ''),
                      ];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segment kriterleri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Segmentler çakışabilir; bir müşteri birden fazla segmentte görünebilir.
              Toplam segment ataması:{' '}
              <strong>{totalAssignments.toLocaleString('tr-TR')}</strong>
            </p>
            <ul className="space-y-3">
              {SEGMENT_ORDER.map((key) => (
                <li key={key} className="flex gap-2">
                  <Badge variant="outline" className={SEGMENT_BADGE_CLASS[key]}>
                    {SEGMENT_LABELS[key]}
                  </Badge>
                  <span className="text-muted-foreground">{SEGMENT_CRITERIA[key]}</span>
                </li>
              ))}
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
