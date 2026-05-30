import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertTriangle,
  Ban,
  Coins,
  Package,
  ShoppingCart,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import type { StockKpiMetrics } from '../hooks/useStockKpis';

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface Props {
  metrics: StockKpiMetrics;
  loading: boolean;
  errorMessage?: string;
}

interface KpiCardProps {
  title: string;
  value: string;
  icon: typeof Package;
  tone: string;
  loading: boolean;
  badge?: ReactElement;
  valueClass?: string;
}

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
  loading,
  badge,
  valueClass,
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
            <p
              className={`text-2xl font-bold tabular-nums tracking-tight ${valueClass ?? ''}`}
            >
              {value}
            </p>
            {badge}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StockKpiRow({
  metrics,
  loading,
  errorMessage,
}: Props): ReactElement {
  const { t } = useTranslation();
  const kpiCount = metrics.showTotalStockValue ? 5 : 4;

  if (errorMessage) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {errorMessage}
      </p>
    );
  }

  return (
    <div
      className={
        kpiCount === 5
          ? 'grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5'
          : 'grid grid-cols-2 gap-4 lg:grid-cols-4'
      }
    >
      <KpiCard
        title={t('stock.kpi.totalSku')}
        value={loading ? '—' : metrics.totalSkuCount.toLocaleString('tr-TR')}
        icon={Package}
        tone="text-sky-600 dark:text-sky-400"
        loading={loading}
      />
      <KpiCard
        title={t('stock.kpi.critical')}
        value={loading ? '—' : metrics.criticalCount.toLocaleString('tr-TR')}
        icon={AlertTriangle}
        tone="text-red-600 dark:text-red-400"
        loading={loading}
        valueClass="text-red-600 dark:text-red-400"
        badge={
          !loading && metrics.criticalCount > 0 ? (
            <Badge variant="destructive" className="tabular-nums">
              {metrics.criticalCount}
            </Badge>
          ) : undefined
        }
      />
      <KpiCard
        title={t('stock.kpi.outOfStock')}
        value={loading ? '—' : metrics.outOfStockCount.toLocaleString('tr-TR')}
        icon={Ban}
        tone="text-red-600 dark:text-red-400"
        loading={loading}
        valueClass="text-red-600 dark:text-red-400"
        badge={
          !loading && metrics.outOfStockCount > 0 ? (
            <Badge variant="destructive" className="tabular-nums">
              {metrics.outOfStockCount}
            </Badge>
          ) : undefined
        }
      />
      <KpiCard
        title={t('stock.kpi.reserved')}
        value={loading ? '—' : metrics.reservedStock.toLocaleString('tr-TR')}
        icon={ShoppingCart}
        tone="text-amber-600 dark:text-amber-400"
        loading={loading}
      />
      {metrics.showTotalStockValue ? (
        <KpiCard
          title={t('stock.kpi.totalStockValue')}
          value={
            loading || metrics.totalStockValue <= 0
              ? '—'
              : formatTry(metrics.totalStockValue)
          }
          icon={Coins}
          tone="text-emerald-600 dark:text-emerald-400"
          loading={loading}
        />
      ) : null}
    </div>
  );
}
