import type { ReactElement } from 'react';
import { Plug, ShoppingCart } from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { LazyAreaChart } from '@/components/charts/LazyAreaChart';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { OrgPlanTier } from '@/types/auth';

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

const PIE_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24'];

interface Props {
  revenueChartData: { label: string; revenueTry: number }[];
  planPieData: { name: string; value: number; plan: OrgPlanTier }[];
  signupBarData: { label: string; count: number }[];
  ordersThisMonthCount: number;
  activeMarketplaceConnections: number;
}

export function AdminDashboardCharts({
  revenueChartData,
  planPieData,
  signupBarData,
  ordersThisMonthCount,
  activeMarketplaceConnections,
}: Props): ReactElement {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="border-slate-200 shadow-sm lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">
            Son 12 ay gelir (başarılı ödemeler)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LazyAreaChart data={revenueChartData}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  `${(v as number).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                }
              />
              <Tooltip
                formatter={(value) => {
                  const v =
                    typeof value === 'number'
                      ? value
                      : Number(value ?? 0);
                  return [tryFormatter.format(v), 'Gelir'];
                }}
                labelFormatter={(l) => String(l)}
              />
              <Area
                type="monotone"
                dataKey="revenueTry"
                stroke="#0ea5e9"
                fillOpacity={1}
                fill="url(#revFill)"
                strokeWidth={2}
              />
            </LazyAreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Paket dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={planPieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={88}
                label={({ name, percent }) =>
                  `${name} (${((percent as number) * 100).toFixed(0)}%)`
                }
              >
                {planPieData.map((entry, i) => (
                  <Cell
                    key={entry.plan}
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => {
                  const n =
                    typeof value === 'number'
                      ? value
                      : Number(value ?? 0);
                  return [`${n} org`, 'Sayı'];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm lg:col-span-3">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Günlük yeni kayıt (son 30 gün)</CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShoppingCart className="size-3.5" aria-hidden />
            Bu ay sipariş:{' '}
            <span className="font-medium text-foreground">
              {ordersThisMonthCount.toLocaleString('tr-TR')}
            </span>
            <span className="mx-1">·</span>
            <Plug className="size-3.5" aria-hidden />
            Aktif bağlantı:{' '}
            <span className="font-medium text-foreground">
              {activeMarketplaceConnections.toLocaleString('tr-TR')}
            </span>
          </div>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={signupBarData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => {
                  const n =
                    typeof value === 'number'
                      ? value
                      : Number(value ?? 0);
                  return [`${n}`, 'Yeni org'];
                }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
