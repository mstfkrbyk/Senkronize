import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatInvoiceAmount } from '@/pages/invoices/invoice-utils';

import type { AccountingRevenueTrendPoint } from './accounting-overview.types';

const GRADIENT_ID = 'accountingRevenueGradient';

export interface AccountingRevenueChartRow {
  period: string;
  revenue: number;
  invoiceCount: number;
}

interface Props {
  points: AccountingRevenueTrendPoint[];
  currency: string;
  loading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}

function toChartRows(points: AccountingRevenueTrendPoint[]): AccountingRevenueChartRow[] {
  return points.map((point) => ({
    period: format(parseISO(`${point.month}-01`), 'MMM yy', { locale: tr }),
    revenue: Number(point.totalAmount) || 0,
    invoiceCount: point.invoiceCount,
  }));
}

export function AccountingRevenueTrendChart({
  points,
  currency,
  loading = false,
  errorMessage = null,
  onRetry,
}: Props): ReactElement {
  const { t } = useTranslation();
  const data = useMemo(() => toChartRows(points), [points]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('accounting.revenueTrend')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('accounting.revenueTrendHint')}</p>
      </CardHeader>
      <CardContent className="h-80">
        {loading ? (
          <div className="flex h-full flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t('accounting.revenueTrendLoading')}</p>
            <Skeleton className="h-full w-full flex-1" />
          </div>
        ) : errorMessage ? (
          <div className="flex h-full flex-col justify-center gap-2">
            <p className="text-sm font-medium text-destructive">
              {t('accounting.revenueTrendError')}
            </p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            {onRetry ? (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onRetry}>
                {t('common.retry')}
              </Button>
            ) : null}
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={BarChart3}
              title={t('accounting.revenueTrendEmpty')}
              description={t('accounting.revenueTrendEmptyDescription')}
              secondaryAction={{
                label: t('accounting.viewAllInvoices'),
                href: '/invoices',
              }}
            />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
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
                formatter={(value, _name, item) => {
                  const row = item?.payload as AccountingRevenueChartRow | undefined;
                  const amount = formatInvoiceAmount(String(value ?? 0), currency);
                  const count = row?.invoiceCount ?? 0;
                  return [
                    `${amount} · ${t('accounting.revenueTrendInvoiceCount', { count })}`,
                    t('accounting.revenueTrendAmount'),
                  ];
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                fill={`url(#${GRADIENT_ID})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
