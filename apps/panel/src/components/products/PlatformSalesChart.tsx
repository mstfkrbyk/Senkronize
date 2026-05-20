import type { ReactElement } from 'react';

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { ProductAnalyticsResponse } from '@/types/product';

const PIE_COLORS = ['#38bdf8', '#f97316', '#22c55e', '#a855f7', '#ef4444'];

interface Props {
  platforms: ProductAnalyticsResponse['platformDistribution'];
}

function formatTry(value: number): string {
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

export function PlatformSalesChart({ platforms }: Props): ReactElement {
  const totalQty = platforms.reduce((s, p) => s + p.quantity, 0);

  const pieData = platforms.map((p) => ({
    name: getMarketplaceBranding(p.platform).label,
    value: p.quantity,
    platform: p.platform,
    revenue: p.revenue,
    orderCount: p.orderCount,
    returnRatePct: p.returnRatePct,
    weekOrderCount: p.weekOrderCount,
    monthOrderCount: p.monthOrderCount,
  }));

  if (platforms.length === 0) {
    return <p className="text-muted-foreground text-sm">Platform verisi yok.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={80}
              paddingAngle={2}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) {
                  return null;
                }
                const row = payload[0].payload as (typeof pieData)[number];
                return (
                  <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
                    <p className="font-medium">{row.name}</p>
                    <p>Sipariş: {row.orderCount.toLocaleString('tr-TR')}</p>
                    <p>Gelir: {formatTry(row.revenue)}</p>
                    <p>İade oranı: %{row.returnRatePct.toLocaleString('tr-TR')}</p>
                    <p className="text-muted-foreground">
                      Bu hafta: {row.weekOrderCount} · Bu ay: {row.monthOrderCount} sipariş
                    </p>
                  </div>
                );
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead className="text-right">Adet</TableHead>
              <TableHead className="text-right">Gelir</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {platforms.map((p) => {
              const pct =
                totalQty > 0
                  ? Math.round((p.quantity / totalQty) * 1000) / 10
                  : 0;
              return (
                <TableRow key={p.platform}>
                  <TableCell>
                    {getMarketplaceBranding(p.platform).label}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.quantity.toLocaleString('tr-TR')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatTry(p.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">%{pct}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
