import type { ReactElement } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
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

export function OrdersTrendWidget(): ReactElement {
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
    siparis: p.orderCount,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Sipariş trendi</CardTitle>
          <CardDescription>Günlük sipariş adedi</CardDescription>
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
            <LineChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--popover))',
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Line
                type="monotone"
                dataKey="siparis"
                name="Sipariş"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
