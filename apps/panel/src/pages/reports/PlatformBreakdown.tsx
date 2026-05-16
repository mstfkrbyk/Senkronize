import type { ReactElement } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Slice {
  name: string;
  value: number;
}

interface Props {
  data: Slice[];
}

const COLORS = ['#0f172a', '#38bdf8', '#94a3b8', '#22c55e', '#f97316'];

function platformLabel(code: string): string {
  const map: Record<string, string> = {
    TRENDYOL: 'Trendyol',
    HEPSIBURADA: 'Hepsiburada',
    N11: 'n11',
    AMAZON_TR: 'Amazon TR',
  };
  return map[code] ?? code;
}

export function PlatformBreakdown({ data }: Props): ReactElement {
  const chartData = data.map((d) => ({
    ...d,
    name: platformLabel(d.name),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform dağılımı</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {chartData.length === 0 || chartData.every((d) => d.value === 0) ? (
          <p className="text-sm text-muted-foreground">Pasta grafik için veri yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) =>
                  `${name} %${((percent ?? 0) * 100).toFixed(0)}`
                }
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={COLORS[index % COLORS.length]}
                    stroke="hsl(var(--background))"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => {
                  const v = value == null ? 0 : Number(value);
                  return new Intl.NumberFormat('tr-TR', {
                    style: 'currency',
                    currency: 'TRY',
                    maximumFractionDigits: 0,
                  }).format(v);
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
