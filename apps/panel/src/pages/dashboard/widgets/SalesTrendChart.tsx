import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardPeriod } from '@/hooks/useDashboardPeriod';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DashboardOrdersTrendPoint } from '@/types/dashboard-widgets';

function formatTry(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

interface Props {
  className?: string;
}

export function SalesTrendChart({ className }: Props): ReactElement {
  const { t } = useTranslation();
  const { api: periodApi } = useDashboardPeriod();

  const trendQuery = useQuery({
    queryKey: ['dashboard', 'sales-trend', periodApi.queryKey, periodApi.trendDays],
    queryFn: async (): Promise<DashboardOrdersTrendPoint[]> => {
      const { data } = await api.get<{ points: DashboardOrdersTrendPoint[] }>(
        '/dashboard/orders-trend',
        { params: { days: periodApi.trendDays } },
      );
      return data.points;
    },
    staleTime: 60_000,
  });

  const chartData = (trendQuery.data ?? []).map((p) => ({
    label: p.label,
    gelir: p.revenue,
    siparis: p.orderCount,
  }));

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle>{t('dashboard.salesTrend')}</CardTitle>
        <CardDescription>{t('dashboard.salesTrendDesc', { days: periodApi.trendDays })}</CardDescription>
      </CardHeader>
      <CardContent className="h-56 min-h-[14rem]">
        {trendQuery.isPending ? (
          <Skeleton className="h-full w-full" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noSalesData')}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={160}>
            <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => formatTry(v)}
              />
              <Tooltip
                formatter={(v, name) => {
                  if (name === 'gelir') {
                    return formatTry(Number(v ?? 0));
                  }
                  return String(v ?? 0);
                }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--popover))',
                }}
              />
              <Area
                type="monotone"
                dataKey="gelir"
                name="gelir"
                stroke="hsl(199 89% 48%)"
                fill="hsl(199 89% 48% / 0.15)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
