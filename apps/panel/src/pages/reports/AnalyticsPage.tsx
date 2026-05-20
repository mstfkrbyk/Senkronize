import type { ReactElement } from 'react';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';
import type { ComparisonMetricTriple } from '@/types/analytics';
import { cn } from '@/lib/utils';

import {
  presetLabel,
  useAnalyticsComparison,
  type AnalyticsPeriodPreset,
} from './hooks/useAnalyticsComparison';
import { formatTry } from './report-utils';

function formatPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function changeBadgeClass(change: number): string {
  if (change > 0) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (change < 0) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-muted bg-muted/50 text-muted-foreground';
}

interface MetricRowProps {
  label: string;
  triple: ComparisonMetricTriple;
  formatValue: (n: number) => string;
}

function MetricRow({ label, triple, formatValue }: MetricRowProps): ReactElement {
  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right tabular-nums">{formatValue(triple.current)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatValue(triple.previous)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatValue(triple.yearAgo)}</TableCell>
      <TableCell className="text-right">
        <Badge variant="outline" className={cn('font-normal', changeBadgeClass(triple.changeVsPrevious))}>
          {formatPct(triple.changeVsPrevious)}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export function AnalyticsPage(): ReactElement {
  const [preset, setPreset] = useState<AnalyticsPeriodPreset>('month');
  const { comparisonQuery, extendedMetrics, isLoading } = useAnalyticsComparison(preset);

  const summary = comparisonQuery.data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {presetLabel(preset)} · önceki dönem ve geçen yıl aynı dönem karşılaştırması
        </p>
        <Select
          value={preset}
          onValueChange={(v) => setPreset(v as AnalyticsPeriodPreset)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Bu ay</SelectItem>
            <SelectItem value="quarter">Bu çeyrek</SelectItem>
            <SelectItem value="year">Bu yıl</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : comparisonQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{getApiErrorMessage(comparisonQuery.error)}</AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Özet metrikler</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metrik</TableHead>
                    <TableHead className="text-right">Bu dönem</TableHead>
                    <TableHead className="text-right">Önceki dönem</TableHead>
                    <TableHead className="text-right">Geçen yıl aynı dönem</TableHead>
                    <TableHead className="text-right">Değişim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary ? (
                    <>
                      <MetricRow
                        label="Gelir"
                        triple={summary.revenue}
                        formatValue={formatTry}
                      />
                      <MetricRow
                        label="Sipariş"
                        triple={summary.orders}
                        formatValue={(n) => String(Math.round(n))}
                      />
                      <MetricRow
                        label="AOV"
                        triple={summary.avgOrderValue}
                        formatValue={formatTry}
                      />
                      {extendedMetrics ? (
                        <>
                          <MetricRow
                            label="Ürün satışı"
                            triple={extendedMetrics.productSales}
                            formatValue={(n) => String(Math.round(n))}
                          />
                          <MetricRow
                            label="İade oranı"
                            triple={extendedMetrics.returnRate}
                            formatValue={(n) => `${n.toFixed(1)}%`}
                          />
                        </>
                      ) : null}
                    </>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform karşılaştırması</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Gelir (bu dönem)</TableHead>
                    <TableHead className="text-right">Önceki dönem</TableHead>
                    <TableHead className="text-right">Geçen yıl</TableHead>
                    <TableHead className="text-right">Değişim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(comparisonQuery.data?.platforms ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Platform verisi yok.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (comparisonQuery.data?.platforms ?? []).map((row) => (
                      <TableRow key={row.platform}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.revenue.current)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.revenue.previous)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.revenue.yearAgo)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-normal',
                              changeBadgeClass(row.revenue.changeVsPrevious),
                            )}
                          >
                            {formatPct(row.revenue.changeVsPrevious)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kategori karşılaştırması</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Gelir (bu dönem)</TableHead>
                    <TableHead className="text-right">Önceki dönem</TableHead>
                    <TableHead className="text-right">Geçen yıl</TableHead>
                    <TableHead className="text-right">Değişim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(comparisonQuery.data?.categories ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Kategori verisi yok.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (comparisonQuery.data?.categories ?? []).map((row) => (
                      <TableRow key={row.categoryId ?? row.categoryName}>
                        <TableCell>{row.categoryName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.revenue.current)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.revenue.previous)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.revenue.yearAgo)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-normal',
                              changeBadgeClass(row.revenue.changeVsPrevious),
                            )}
                          >
                            {formatPct(row.revenue.changeVsPrevious)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
