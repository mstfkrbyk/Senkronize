import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShoppingCart } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
import { api, getApiErrorMessage } from '@/lib/api';
import type { StockoutEstimateDto } from '@/types/stock-forecast';

function rowToneClass(days: number | null): string {
  if (days === null || !Number.isFinite(days)) {
    return '';
  }
  if (days < 7) {
    return 'bg-red-50/90 dark:bg-red-950/30';
  }
  if (days < 14) {
    return 'bg-amber-50/90 dark:bg-amber-950/25';
  }
  return '';
}

function chartDays(days: number | null): number {
  if (days === null || !Number.isFinite(days)) {
    return 60;
  }
  if (days < 0) {
    return 0;
  }
  return Math.min(60, Math.ceil(days));
}

export function StockForecastTab(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const forecastQuery = useQuery({
    queryKey: ['stock-forecast', 'bulk'],
    queryFn: async (): Promise<StockoutEstimateDto[]> => {
      const { data } = await api.get<{ data: StockoutEstimateDto[] }>(
        '/stock/forecast',
      );
      return data.data;
    },
  });

  const rows = useMemo(() => {
    const list = forecastQuery.data ?? [];
    return [...list].sort((a, b) => {
      const da = a.daysUntilStockout ?? 999;
      const db = b.daysUntilStockout ?? 999;
      return da - db;
    });
  }, [forecastQuery.data]);

  const chartData = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.daysUntilStockout !== null &&
            Number.isFinite(r.daysUntilStockout) &&
            r.daysUntilStockout >= 0 &&
            r.daysUntilStockout <= 60,
        )
        .slice(0, 12)
        .map((r) => ({
          name:
            (r.name.length > 18 ? `${r.name.slice(0, 16)}…` : r.name) ||
            r.barcode,
          days: chartDays(r.daysUntilStockout),
        })),
    [rows],
  );

  const createPo = (row: StockoutEstimateDto): void => {
    const params = new URLSearchParams();
    params.set('barcode', row.barcode);
    params.set('name', row.name);
    params.set('qty', String(Math.max(1, row.recommendedOrderQty || 1)));
    navigate(`/purchase-orders?${params.toString()}`);
  };

  if (forecastQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  if (forecastQuery.isError) {
    return (
      <p className="text-destructive text-sm">
        {getApiErrorMessage(forecastQuery.error)}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('stock.forecast.chartTitle')}</CardTitle>
          <CardDescription>{t('stock.forecast.chartDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {chartData.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('stock.forecast.chartEmpty')}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-35}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{
                    value: t('stock.forecast.daysAxis'),
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11 },
                  }}
                />
                <Tooltip
                  formatter={(value) => [
                    `${value ?? 0} ${t('stock.forecast.daysUnit')}`,
                    t('stock.forecast.daysUntilOut'),
                  ]}
                />
                <Bar dataKey="days" name={t('stock.forecast.daysUntilOut')} fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('stock.forecast.product')}</TableHead>
              <TableHead className="text-right">{t('stock.forecast.dailySales')}</TableHead>
              <TableHead className="text-right">{t('stock.forecast.currentStock')}</TableHead>
              <TableHead>{t('stock.forecast.stockoutDate')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t('stock.forecast.empty')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.productId}
                  className={rowToneClass(row.daysUntilStockout)}
                >
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {row.sku ?? row.barcode}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.dailyVelocity.toLocaleString('tr-TR')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.currentStock.toLocaleString('tr-TR')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="w-fit">
                      {row.daysUntilStockout !== null &&
                      Number.isFinite(row.daysUntilStockout)
                        ? row.daysUntilStockout < 0
                          ? t('stock.out')
                          : `${row.daysUntilStockout.toFixed(1)} ${t('stock.forecast.daysUnit')}`
                        : '—'}
                    </Badge>
                    {row.estimatedStockoutDate ? (
                      <div className="text-muted-foreground mt-1 text-xs">
                        {format(parseISO(row.estimatedStockoutDate), 'd MMM yyyy', {
                          locale: tr,
                        })}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {(row.daysUntilStockout ?? 99) < 14 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => createPo(row)}
                      >
                        <ShoppingCart className="size-3.5" aria-hidden />
                        {t('stock.forecast.order')}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
