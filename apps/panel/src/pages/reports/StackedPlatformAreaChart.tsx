import type { ReactElement } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { CHART_PLATFORM_COLORS, formatTry, platformDisplayName } from './report-utils';

interface Props {
  data: Array<Record<string, string | number>>;
  platforms: string[];
}

export function StackedPlatformAreaChart({ data, platforms }: Props): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform bazlı gelir (yığılmış)</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Grafik için veri yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
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
                formatter={(value, name) => [
                  formatTry(Number(value ?? 0)),
                  platformDisplayName(String(name)),
                ]}
              />
              <Legend formatter={(value) => platformDisplayName(String(value))} />
              {platforms.map((p) => (
                <Area
                  key={p}
                  type="monotone"
                  dataKey={p}
                  stackId="revenue"
                  stroke={CHART_PLATFORM_COLORS[p] ?? '#64748b'}
                  fill={CHART_PLATFORM_COLORS[p] ?? '#64748b'}
                  fillOpacity={0.65}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
