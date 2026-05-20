import type { ReactElement } from 'react';
import { Plug, ShoppingCart } from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getMarketplaceDisplay } from '@/lib/platform-display';
import type {
  AdminCohortData,
  AdminPlatformUsageItem,
} from '@/types/admin';
import type { OrgPlanTier } from '@/types/auth';

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

const PIE_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24'];

function cohortCellClass(rate: number): string {
  if (rate >= 80) {
    return 'bg-emerald-100 text-emerald-900';
  }
  if (rate >= 50) {
    return 'bg-amber-100 text-amber-900';
  }
  return 'bg-rose-100 text-rose-900';
}

interface Props {
  revenueChartData: { label: string; revenueTry: number }[];
  planPieData: { name: string; value: number; plan: OrgPlanTier }[];
  signupBarData: { label: string; count: number }[];
  growthChartData: {
    label: string;
    newOrganizations: number;
    activeOrganizations: number;
    mrrTry: number;
  }[];
  marketplaceUsage: AdminPlatformUsageItem[];
  erpUsage: AdminPlatformUsageItem[];
  cohortData: AdminCohortData[];
  ordersThisMonthCount: number;
  activeMarketplaceConnections: number;
}

export function AdminDashboardCharts({
  revenueChartData,
  planPieData,
  signupBarData,
  growthChartData,
  marketplaceUsage,
  erpUsage,
  cohortData,
  ordersThisMonthCount,
  activeMarketplaceConnections,
}: Props): ReactElement {
  const maxCohortOffset = cohortData.reduce(
    (max, row) => Math.max(max, row.retention.length - 1),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Büyüme trendi (son 12 ay)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    `${(v as number).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                  }
                />
                <Tooltip
                  formatter={(value, name) => {
                    const v =
                      typeof value === 'number' ? value : Number(value ?? 0);
                    if (name === 'mrrTry') {
                      return [tryFormatter.format(v), 'MRR'];
                    }
                    return [
                      v.toLocaleString('tr-TR'),
                      name === 'newOrganizations' ? 'Yeni kayıt' : 'Aktif org',
                    ];
                  }}
                />
                <Legend
                  formatter={(value) => {
                    if (value === 'newOrganizations') return 'Yeni kayıt';
                    if (value === 'activeOrganizations') return 'Aktif org';
                    if (value === 'mrrTry') return 'MRR';
                    return String(value);
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="newOrganizations"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="activeOrganizations"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="mrrTry"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Paket dağılımı</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              Top 10 pazaryeri bağlantısı
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {marketplaceUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Veri yok.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={marketplaceUsage.map((m) => ({
                    label: getMarketplaceDisplay(m.key).label,
                    count: m.count,
                  }))}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={100}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip formatter={(v) => [`${v}`, 'Bağlantı']} />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top 5 ERP bağlantısı</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {erpUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Veri yok.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={erpUsage.map((e) => ({
                    label: e.label.replace(/_/g, ' '),
                    count: e.count,
                  }))}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={100}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip formatter={(v) => [`${v}`, 'Bağlantı']} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

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
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Günlük yeni kayıt (30 gün)
            </CardTitle>
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

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Cohort retention matrisi</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {cohortData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz cohort verisi yok.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kayıt ayı</TableHead>
                  <TableHead className="text-right">Boyut</TableHead>
                  {Array.from({ length: maxCohortOffset + 1 }).map((_, i) => (
                    <TableHead key={i} className="text-center">
                      +{i} ay
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortData.map((row) => (
                  <TableRow key={row.cohortMonth}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {row.cohortMonth}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.cohortSize}
                    </TableCell>
                    {Array.from({ length: maxCohortOffset + 1 }).map(
                      (_, offset) => {
                        const cell = row.retention.find(
                          (r) => r.monthOffset === offset,
                        );
                        if (!cell) {
                          return (
                            <TableCell
                              key={offset}
                              className="text-center text-muted-foreground"
                            >
                              —
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={offset} className="p-1">
                            <span
                              className={`inline-block min-w-[3rem] rounded px-2 py-1 text-center text-xs font-medium tabular-nums ${cohortCellClass(cell.rate)}`}
                            >
                              {cell.rate.toFixed(0)}%
                            </span>
                          </TableCell>
                        );
                      },
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Renk: ≥80% yeşil · ≥50% sarı · &lt;50% kırmızı
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
