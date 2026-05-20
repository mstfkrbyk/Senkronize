import type { ReactElement } from 'react';
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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { formatTry, platformDisplayName } from './report-utils';

interface Props {
  data: Array<{ platform: string; revenue: number; orders: number }>;
}

export function PlatformComparisonBarChart({ data }: Props): ReactElement {
  const chartData = data.map((d) => ({
    ...d,
    label: platformDisplayName(d.platform),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform karşılaştırma</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Karşılaştırma için veri yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
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
                  const v = Number(value ?? 0);
                  if (name === 'revenue') return [formatTry(v), 'Gelir'];
                  return [v, 'Sipariş'];
                }}
              />
              <Legend formatter={(v) => (v === 'revenue' ? 'Gelir (₺)' : 'Sipariş')} />
              <Bar dataKey="revenue" name="revenue" fill="#0f172a" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="orders"
                name="orders"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
