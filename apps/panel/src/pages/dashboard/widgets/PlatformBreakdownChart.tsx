import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { DashboardPlatformSlice } from '@/types/dashboard-widgets';

const COLORS = [
  'hsl(199 89% 48%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(262 83% 58%)',
  'hsl(0 72% 51%)',
  'hsl(215 20% 45%)',
];

export function PlatformBreakdownChart(): ReactElement {
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ['dashboard', 'platform-breakdown'],
    queryFn: async (): Promise<DashboardPlatformSlice[]> => {
      const { data } = await api.get<{ slices: DashboardPlatformSlice[] }>(
        '/dashboard/platform-distribution',
      );
      return data.slices;
    },
    staleTime: 120_000,
  });

  const chartData = (query.data ?? [])
    .filter((s) => s.orderCount > 0)
    .map((s) => ({
      name: s.label,
      value: s.orderCount,
    }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('dashboard.platformBreakdown')}</CardTitle>
        <CardDescription>{t('dashboard.platformBreakdownDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="h-64 min-h-[14rem]">
        {query.isPending ? (
          <Skeleton className="h-full w-full" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noPlatformData')}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={72}
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {chartData.map((_, i) => (
                  <Cell key={chartData[i]?.name ?? i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
