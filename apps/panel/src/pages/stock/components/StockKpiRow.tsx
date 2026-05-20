import type { ReactElement } from 'react';

import {
  AlertTriangle,
  ArrowLeftRight,
  Package,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import type { StockKpiMetrics } from '../hooks/useStockKpis';

interface Props {
  metrics: StockKpiMetrics;
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
  icon: typeof Package;
  tone: string;
  loading: boolean;
  badge?: ReactElement;
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
  loading,
  badge,
}: KpiCardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`size-5 ${tone}`} aria-hidden />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {value}
            </p>
            {badge}
          </div>
        )}
        {sub && !loading ? (
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StockKpiRow({ metrics, loading }: Props): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        title="Toplam stok değeri"
        value={loading ? '—' : metrics.totalValueTry > 0 ? formatTry(metrics.totalValueTry) : '—'}
        sub="Maliyet fiyatı × stok"
        icon={Package}
        tone="text-sky-600"
        loading={loading}
      />
      <KpiCard
        title="Kritik stok"
        value={loading ? '—' : String(metrics.criticalCount)}
        sub="Eşik altı ürün"
        icon={AlertTriangle}
        tone="text-red-600"
        loading={loading}
        badge={
          !loading && metrics.criticalCount > 0 ? (
            <Badge variant="destructive" className="tabular-nums">
              {metrics.criticalCount}
            </Badge>
          ) : undefined
        }
      />
      <KpiCard
        title="Stok hareket hacmi"
        value={
          loading
            ? '—'
            : metrics.movementVolume7d.toLocaleString('tr-TR')
        }
        sub="Son 7 gün (giriş + çıkış)"
        icon={ArrowLeftRight}
        tone="text-amber-600"
        loading={loading}
      />
      <KpiCard
        title="Ort. stok dönüş hızı"
        value={loading ? '—' : `${metrics.avgTurnoverRate.toLocaleString('tr-TR')}×`}
        sub="Haftalık çıkış / toplam stok"
        icon={TrendingUp}
        tone="text-emerald-600"
        loading={loading}
      />
    </div>
  );
}
