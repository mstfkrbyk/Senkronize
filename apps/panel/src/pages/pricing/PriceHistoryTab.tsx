import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { SearchableCombobox } from '@/components/SearchableCombobox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { marketplacePlatformLabel } from '@/lib/platform-labels';
import { cn } from '@/lib/utils';
import { useListings } from '@/pages/listings/hooks/useListings';
import type { OrgPlanTier } from '@/types/auth';
import type { ListingPriceHistoryItem, PriceHistoryEntry } from '@/types/pricing';

import { useListingPriceHistory, usePriceHistory } from './hooks/usePricing';
import { PRICING_CHART_COLORS, PRICING_CHART_GRID_CLASS } from './pricing-chart';
import { pricingDateLocale } from './pricing-i18n';
import { REASON_LABELS, formatTry, pctChange } from './pricing-utils';

type ChangeDirection = 'all' | 'up' | 'down';

function mapReason(
  source: string,
  reason: string | null,
  t: (key: string) => string,
): string {
  const key = (reason ?? source).toLowerCase();
  if (key.includes('buybox') || key.includes('buy_box')) {
    return t('pricing.history.reasonBuybox');
  }
  if (key.includes('rule') || key.includes('kural')) {
    return t('pricing.history.reasonRule');
  }
  if (key.includes('manual') || key.includes('manuel')) {
    return t('pricing.history.reasonManual');
  }
  return REASON_LABELS[source] ?? reason ?? source;
}

interface Props {
  proAccess: boolean;
  plan: OrgPlanTier | undefined;
}

export function PriceHistoryTab({ proAccess, plan }: Props): ReactElement {
  const { t } = useTranslation();
  const dateLocale = pricingDateLocale();
  const [listingId, setListingId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [changeDir, setChangeDir] = useState<ChangeDirection>('all');

  const listingsQuery = useListings({ page: 1, limit: 200 }, proAccess);
  const listingHistoryQuery = useListingPriceHistory(listingId, 30, proAccess);
  const globalHistoryQuery = usePriceHistory(
    listingId
      ? undefined
      : platformFilter !== 'all'
        ? { platform: platformFilter }
        : undefined,
    proAccess && listingId == null,
  );

  const comboboxOptions = useMemo(
    () =>
      (listingsQuery.data?.items ?? []).map((l) => ({
        value: l.id,
        label: `${l.title.slice(0, 50)}${l.title.length > 50 ? '…' : ''} — ${l.barcode}`,
      })),
    [listingsQuery.data?.items],
  );

  const chartData = useMemo(
    () =>
      (listingHistoryQuery.data?.chart ?? []).map((p) => ({
        ...p,
        label: format(new Date(p.date), 'd MMM', { locale: dateLocale }),
      })),
    [listingHistoryQuery.data?.chart, dateLocale],
  );

  const tableRows = useMemo((): Array<{
    id: string;
    appliedAt: string;
    oldPrice: string;
    newPrice: string;
    changePct: number;
    platform: string;
    reason: string;
  }> => {
    if (listingId && listingHistoryQuery.data) {
      return listingHistoryQuery.data.items.map((row: ListingPriceHistoryItem) => ({
        id: row.id,
        appliedAt: row.appliedAt,
        oldPrice: row.previousPrice ?? row.price,
        newPrice: row.price,
        changePct: row.changePct ?? 0,
        platform: listingHistoryQuery.data.platform,
        reason: mapReason(row.source, row.reason, t),
      }));
    }
    return (globalHistoryQuery.data?.items ?? []).map((row: PriceHistoryEntry) => ({
      id: row.id,
      appliedAt: row.appliedAt,
      oldPrice: row.oldPrice,
      newPrice: row.newPrice,
      changePct: pctChange(row.oldPrice, row.newPrice),
      platform: row.platform,
      reason: mapReason(row.reason ?? '', row.reason, t),
    }));
  }, [listingId, listingHistoryQuery.data, globalHistoryQuery.data?.items, t]);

  const filteredRows = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    return tableRows.filter((row) => {
      const d = new Date(row.appliedAt);
      if (d < from || d > to) {
        return false;
      }
      if (platformFilter !== 'all' && row.platform !== platformFilter) {
        return false;
      }
      if (changeDir === 'up' && row.changePct <= 0) {
        return false;
      }
      if (changeDir === 'down' && row.changePct >= 0) {
        return false;
      }
      return true;
    });
  }, [tableRows, dateFrom, dateTo, platformFilter, changeDir]);

  const platforms = useMemo(() => {
    const set = new Set(tableRows.map((r) => r.platform));
    return Array.from(set).sort();
  }, [tableRows]);

  if (!proAccess) {
    return (
      <UpgradePrompt
        feature={t('pricing.upgrade.historyFeature')}
        requiredPlan="PRO"
        currentPlan={plan}
        description={t('pricing.upgrade.historyDesc')}
      />
    );
  }

  const isLoading =
    listingsQuery.isLoading ||
    (listingId != null && listingHistoryQuery.isLoading) ||
    (listingId == null && globalHistoryQuery.isLoading);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="space-y-2">
          <Label>{t('pricing.history.searchProduct')}</Label>
          {listingsQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <SearchableCombobox
              options={comboboxOptions}
              value={listingId}
              onChange={(v) => setListingId(v)}
              placeholder={t('pricing.history.searchPlaceholder')}
              searchPlaceholder={t('pricing.competitors.searchPlaceholder')}
              emptyLabel={t('pricing.history.notFound')}
            />
          )}
          <p className="text-xs text-muted-foreground">{t('pricing.history.searchHint')}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{t('pricing.common.platform')}</Label>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pricing.common.all')}</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p}>
                    {marketplacePlatformLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-from">{t('pricing.history.startDate')}</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-to">{t('pricing.history.endDate')}</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('pricing.history.changeDirection')}</Label>
            <Select value={changeDir} onValueChange={(v) => setChangeDir(v as ChangeDirection)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pricing.common.all')}</SelectItem>
                <SelectItem value="up">{t('pricing.history.increase')}</SelectItem>
                <SelectItem value="down">{t('pricing.history.decrease')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {listingId && listingHistoryQuery.data ? (
        <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <span className="font-medium">{listingHistoryQuery.data.title}</span>
          <span className="text-muted-foreground">
            {' '}
            · {t('pricing.history.currentPrice', {
              price: formatTry(listingHistoryQuery.data.currentPrice),
            })}
          </span>
        </div>
      ) : null}

      {listingId && chartData.length > 0 ? (
        <div className="rounded-md border p-4">
          <p className="mb-3 text-sm font-medium">{t('pricing.history.chartTitle')}</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className={PRICING_CHART_GRID_CLASS} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} stroke="currentColor" />
                <Tooltip
                  formatter={(v) => formatTry(typeof v === 'number' ? v : null)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="ourPrice"
                  name={t('pricing.history.ourPrice')}
                  stroke={PRICING_CHART_COLORS.our}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="lowestCompetitor"
                  name={t('pricing.history.lowestCompetitor')}
                  stroke={PRICING_CHART_COLORS.competitor1}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="avgCompetitor"
                  name={t('pricing.history.avgCompetitor')}
                  stroke={PRICING_CHART_COLORS.competitor2}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {listingId && !listingHistoryQuery.isLoading && chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('pricing.common.noChartData')}</p>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : null}

      {(listingId != null && listingHistoryQuery.isError) ||
      (listingId == null && globalHistoryQuery.isError) ? (
        <QueryErrorAlert
          error={listingHistoryQuery.error ?? globalHistoryQuery.error}
          onRetry={() => {
            void listingHistoryQuery.refetch();
            void globalHistoryQuery.refetch();
          }}
        />
      ) : null}

      {!isLoading && filteredRows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {t('pricing.history.empty')}
        </p>
      ) : null}

      {!isLoading && filteredRows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pricing.history.date')}</TableHead>
                <TableHead>{t('pricing.history.oldPrice')}</TableHead>
                <TableHead>{t('pricing.history.newPrice')}</TableHead>
                <TableHead>{t('pricing.history.changePct')}</TableHead>
                <TableHead>{t('pricing.common.platform')}</TableHead>
                <TableHead>{t('pricing.history.reason')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(row.appliedAt), 'd MMM yyyy HH:mm', { locale: dateLocale })}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatTry(row.oldPrice)}</TableCell>
                  <TableCell className="tabular-nums">{formatTry(row.newPrice)}</TableCell>
                  <TableCell>
                    {row.changePct === 0 ? (
                      '—'
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn(
                          row.changePct < 0
                            ? 'border-green-500 text-green-700 dark:border-green-600 dark:text-green-400'
                            : 'border-red-500 text-red-700 dark:border-red-600 dark:text-red-400',
                        )}
                      >
                        {row.changePct > 0 ? '+' : ''}
                        {row.changePct.toFixed(1)}%
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{marketplacePlatformLabel(row.platform)}</TableCell>
                  <TableCell>{row.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
