import type { ReactElement } from 'react';

import {
  AlertTriangle,
  Clock,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { OrderSummaryDto } from '@/types/order';

interface Props {
  summary: OrderSummaryDto | undefined;
  loading: boolean;
}

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: typeof ShoppingCart;
  tone: string;
  loading: boolean;
}

function KpiCard({ title, value, sub, icon: Icon, tone, loading }: KpiCardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${tone}`} aria-hidden />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
            {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function OrdersKpiRow({ summary, loading }: Props): ReactElement {
  const todayCount = summary?.todayOrders ?? 0;
  const todayRevenue = summary?.todayRevenue ?? 0;
  const pending = summary?.pendingOrders ?? 0;
  const cancelReturnRate = summary?.cancelReturnRate ?? 0;
  const avgOrder = summary?.averageOrderValue ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        title="Bugün gelen siparişler"
        value={loading ? '—' : String(todayCount)}
        sub={loading ? undefined : formatTry(todayRevenue)}
        icon={ShoppingCart}
        tone="text-sky-600"
        loading={loading}
      />
      <KpiCard
        title="Bekleyen siparişler"
        value={loading ? '—' : String(pending)}
        sub="Kargo verilmemiş"
        icon={Clock}
        tone="text-amber-600"
        loading={loading}
      />
      <KpiCard
        title="İptal / iade oranı"
        value={loading ? '—' : `%${String(cancelReturnRate)}`}
        sub="Tüm siparişlere göre"
        icon={AlertTriangle}
        tone="text-red-600"
        loading={loading}
      />
      <KpiCard
        title="Ortalama sipariş değeri"
        value={loading ? '—' : formatTry(avgOrder)}
        sub="Genel ortalama"
        icon={TrendingUp}
        tone="text-green-600"
        loading={loading}
      />
    </div>
  );
}
