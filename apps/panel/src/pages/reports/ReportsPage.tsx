import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/api';
import type { ReportFilters } from '@/types/report';

import { PlatformBreakdown } from './PlatformBreakdown';
import { SalesChart } from './SalesChart';
import { useSalesReport } from './hooks/useReports';
import {
  aggregateSalesByGroup,
  filterSalesByDateRange,
  filterSalesByPlatform,
  platformRevenueShares,
  summarizeSales,
} from './reportAggregation';

export function ReportsPage(): ReactElement {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [platform, setPlatform] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const filters: ReportFilters = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      platform: platform === 'all' ? undefined : platform,
      groupBy,
    }),
    [startDate, endDate, platform, groupBy],
  );

  const salesQuery = useSalesReport(filters);

  const chartRows = useMemo(() => {
    const raw = salesQuery.data ?? [];
    let next = filterSalesByDateRange(raw, filters.startDate, filters.endDate);
    next = filterSalesByPlatform(next, filters.platform);
    return aggregateSalesByGroup(next, filters.groupBy ?? 'day');
  }, [salesQuery.data, filters]);

  const pieSlices = useMemo(() => platformRevenueShares(chartRows), [chartRows]);
  const summary = useMemo(() => summarizeSales(chartRows), [chartRows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Raporlar</h1>
        <p className="text-muted-foreground">
          Satış performansınızı görselleştirin (şu an örnek veri ile).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="rep-start">Başlangıç</Label>
            <Input
              id="rep-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rep-end">Bitiş</Label>
            <Input
              id="rep-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="TRENDYOL">Trendyol</SelectItem>
                <SelectItem value="HEPSIBURADA">Hepsiburada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gruplama</Label>
            <Select
              value={groupBy}
              onValueChange={(v) => setGroupBy(v as 'day' | 'week' | 'month')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Gün</SelectItem>
                <SelectItem value="week">Hafta</SelectItem>
                <SelectItem value="month">Ay</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {salesQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(salesQuery.error)}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam sipariş
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary">{summary.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam gelir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary">
              {new Intl.NumberFormat('tr-TR', {
                style: 'currency',
                currency: 'TRY',
                maximumFractionDigits: 0,
              }).format(summary.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ortalama sipariş değeri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary">
              {new Intl.NumberFormat('tr-TR', {
                style: 'currency',
                currency: 'TRY',
                maximumFractionDigits: 0,
              }).format(summary.averageOrderValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SalesChart data={chartRows} />
        <PlatformBreakdown data={pieSlices} />
      </div>
    </div>
  );
}
