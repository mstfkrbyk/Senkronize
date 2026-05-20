import type { ReactElement } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { DashboardOrdersTrendPoint } from '@/types/dashboard-widgets';

const PERIODS = [
  { days: 7, label: '7g' },
  { days: 14, label: '14g' },
  { days: 30, label: '30g' },
] as const;

function formatTry(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

export function RevenueChartWidget(): ReactElement {
  const [days, setDays] = useState<7 | 14 | 30>(7);

  const trendQuery = useQuery({
    queryKey: ['dashboard', 'orders-trend', days],
    queryFn: async (): Promise<DashboardOrdersTrendPoint[]> => {
      const { data } = await api.get<{ points: DashboardOrdersTrendPoint[] }>(
        '/dashboard/orders-trend',
        { params: { days } },
      );
      return data.points;
    },
    staleTime: 60_000,
  });

  const chartData = (trendQuery.data ?? []).map((p) => ({
    label: p.label,
    gelir: p.revenue,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Gelir grafiği</CardTitle>
          <CardDescription>Günlük tahmini gelir (TRY)</CardDescription>
        </div>
        <div className="flex shrink-0 gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p.days}
              type="button"
              size="sm"
              variant={days === p.days ? 'default' : 'outline'}
              onClick={() => {
                setDays(p.days);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="h-56 min-h-[14rem]">
        {trendQuery.isPending ? (
          <Skeleton className="h-full w-full" />
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
                formatter={(v) => formatTry(Number(v ?? 0))}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--popover))',
                }}
              />
              <Area
                type="monotone"
                dataKey="gelir"
                name="Gelir"
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
