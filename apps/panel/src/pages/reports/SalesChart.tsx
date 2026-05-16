import type { ReactElement } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SalesReportData } from '@/types/report';

interface Props {
  data: SalesReportData[];
}

export function SalesChart({ data }: Props): ReactElement {
  const chartData = data.map((row) => ({
    ...row,
    label: row.period,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gelir ve sipariş trendi</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Grafik için veri yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  new Intl.NumberFormat('tr-TR', {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(Number(v))
                }
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value, name) => {
                  const v = value == null ? 0 : Number(value);
                  if (name === 'totalRevenue') {
                    return [
                      new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                        maximumFractionDigits: 0,
                      }).format(v),
                      'Gelir',
                    ];
                  }
                  return [v, 'Sipariş'];
                }}
              />
              <Legend
                formatter={(value) =>
                  value === 'totalRevenue' ? 'Gelir (₺)' : 'Sipariş sayısı'
                }
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalRevenue"
                name="totalRevenue"
                stroke="#0f172a"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalOrders"
                name="totalOrders"
                stroke="#38bdf8"
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
