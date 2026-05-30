import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { marketplacePlatformLabel } from '@/lib/platform-labels';
import { cn } from '@/lib/utils';
import { useBulkListingPrice } from '@/pages/listings/hooks/useListings';
import type { OrgPlanTier } from '@/types/auth';
import type { BuyBoxReportTopLoser } from '@/types/pricing';

import {
  useBuyBoxReport,
  useBuyBoxSummary,
  useBuyBoxWinRate,
} from './hooks/usePricing';
import { formatTry } from './pricing-utils';

type BuyBoxStatusFilter = 'all' | 'winning' | 'losing' | 'competitive';

type StatusKey = 'winning' | 'losing' | 'competitive';

function buyBoxBadge(row: BuyBoxReportTopLoser): StatusKey {
  if (row.isWinner) {
    return 'winning';
  }
  const gapPct =
    row.buyBoxReferencePrice > 0
      ? (row.priceGap / row.buyBoxReferencePrice) * 100
      : 100;
  if (gapPct <= 3) {
    return 'competitive';
  }
  return 'losing';
}

function optimalPrice(row: BuyBoxReportTopLoser): number {
  return row.isWinner ? row.currentPrice : row.buyBoxReferencePrice;
}

interface Props {
  proAccess: boolean;
  plan: OrgPlanTier | undefined;
}

export function BuyBoxTab({ proAccess, plan }: Props): ReactElement {
  const { t } = useTranslation();
  const reportQuery = useBuyBoxReport(proAccess);
  const summaryQuery = useBuyBoxSummary(proAccess);
  const winRateQuery = useBuyBoxWinRate(7, proAccess);
  const bulkPriceMutation = useBulkListingPrice();

  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<BuyBoxStatusFilter>('all');
  const [gapMin, setGapMin] = useState('');
  const [gapMax, setGapMax] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const statusLabels: Record<StatusKey, string> = {
    winning: t('pricing.buybox.statusWinning'),
    losing: t('pricing.buybox.statusLosing'),
    competitive: t('pricing.buybox.statusCompetitive'),
  };

  const statusBadgeClass: Record<StatusKey, string> = {
    winning: 'bg-green-600 text-white hover:bg-green-600/90 dark:bg-green-700',
    competitive: '',
    losing: 'border-amber-500 text-amber-700 dark:border-amber-600 dark:text-amber-400',
  };

  const rows = useMemo(() => reportQuery.data?.topLosers ?? [], [reportQuery.data?.topLosers]);

  const filteredRows = useMemo(() => {
    const min = gapMin.trim() === '' ? null : Number.parseFloat(gapMin.replace(',', '.'));
    const max = gapMax.trim() === '' ? null : Number.parseFloat(gapMax.replace(',', '.'));

    return rows.filter((row) => {
      if (platformFilter !== 'all' && row.platform !== platformFilter) {
        return false;
      }
      const status = buyBoxBadge(row);
      if (statusFilter === 'winning' && status !== 'winning') {
        return false;
      }
      if (statusFilter === 'losing' && status !== 'losing') {
        return false;
      }
      if (statusFilter === 'competitive' && status !== 'competitive') {
        return false;
      }
      const gap = Math.abs(row.priceGap);
      if (min != null && !Number.isNaN(min) && gap < min) {
        return false;
      }
      if (max != null && !Number.isNaN(max) && gap > max) {
        return false;
      }
      return true;
    });
  }, [rows, platformFilter, statusFilter, gapMin, gapMax]);

  const avgDeviation = useMemo(() => {
    if (rows.length === 0) {
      return 0;
    }
    const sum = rows.reduce((acc, r) => acc + Math.abs(r.priceGap), 0);
    return sum / rows.length;
  }, [rows]);

  const platforms = useMemo(() => {
    const set = new Set(rows.map((r) => r.platform));
    return Array.from(set).sort();
  }, [rows]);

  const recommendation = (row: BuyBoxReportTopLoser): string => {
    if (row.isWinner) {
      return t('pricing.buybox.keepPrice');
    }
    if (row.priceGap > 0) {
      return t('pricing.buybox.lowerTo', { price: formatTry(row.buyBoxReferencePrice) });
    }
    return t('pricing.buybox.watchCompetitor');
  };

  const toggleRow = (id: string, checked: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleAll = (checked: boolean): void => {
    if (checked) {
      setSelectedIds(new Set(filteredRows.map((r) => r.listingId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const applyAutoPrice = (): void => {
    const selected = filteredRows.filter((r) => selectedIds.has(r.listingId));
    if (selected.length === 0) {
      toast.error(t('pricing.buybox.selectOne'));
      return;
    }
    bulkPriceMutation.mutate(
      selected.map((r) => ({
        id: r.listingId,
        price: optimalPrice(r),
      })),
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          void reportQuery.refetch();
        },
      },
    );
  };

  if (!proAccess) {
    return (
      <UpgradePrompt
        feature={t('pricing.upgrade.buyboxFeature')}
        requiredPlan="PRO"
        currentPlan={plan}
        description={t('pricing.upgrade.buyboxDesc')}
      />
    );
  }

  const isLoading = reportQuery.isLoading || summaryQuery.isLoading;

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : null}

      {reportQuery.isError ? (
        <QueryErrorAlert
          error={reportQuery.error}
          onRetry={() => {
            void reportQuery.refetch();
          }}
        />
      ) : null}

      {reportQuery.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('pricing.buybox.winRate')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-sky-600 tabular-nums dark:text-sky-400">
                  %{(reportQuery.data.winRate * 100).toFixed(1)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('pricing.buybox.listingsCount', {
                    won: reportQuery.data.buyBoxCount,
                    total: reportQuery.data.totalListings,
                  })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('pricing.buybox.winningProducts')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-green-700 dark:text-green-400">
                  {summaryQuery.data?.winningBuyBox ?? reportQuery.data.buyBoxCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('pricing.buybox.losingProducts')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {rows.filter((r) => !r.isWinner).length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('pricing.buybox.avgDeviation')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatTry(avgDeviation)}
                </p>
                {winRateQuery.data ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('pricing.buybox.whenWinning', {
                      price: formatTry(winRateQuery.data.avgPriceWhenWinning),
                    })}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>{t('pricing.common.platform')}</Label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('pricing.common.all')} />
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
                <Label>{t('pricing.buybox.status')}</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as BuyBoxStatusFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('pricing.common.all')}</SelectItem>
                    <SelectItem value="winning">{t('pricing.buybox.statusWinning')}</SelectItem>
                    <SelectItem value="losing">{t('pricing.buybox.statusLosing')}</SelectItem>
                    <SelectItem value="competitive">
                      {t('pricing.buybox.statusCompetitive')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gap-min">{t('pricing.buybox.gapMin')}</Label>
                <Input
                  id="gap-min"
                  inputMode="decimal"
                  placeholder="0"
                  value={gapMin}
                  onChange={(e) => setGapMin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gap-max">{t('pricing.buybox.gapMax')}</Label>
                <Input
                  id="gap-max"
                  inputMode="decimal"
                  placeholder="100"
                  value={gapMax}
                  onChange={(e) => setGapMax(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              className="shrink-0 gap-2"
              disabled={selectedIds.size === 0 || bulkPriceMutation.isPending}
              onClick={applyAutoPrice}
            >
              {bulkPriceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {t('pricing.buybox.autoApply')}
              {selectedIds.size > 0 ? ` (${String(selectedIds.size)})` : ''}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        filteredRows.length > 0 &&
                        filteredRows.every((r) => selectedIds.has(r.listingId))
                      }
                      onCheckedChange={(c) => toggleAll(c === true)}
                      aria-label={t('pricing.common.all')}
                    />
                  </TableHead>
                  <TableHead>{t('pricing.buybox.product')}</TableHead>
                  <TableHead>{t('pricing.common.platform')}</TableHead>
                  <TableHead className="text-right">{t('pricing.buybox.ourPrice')}</TableHead>
                  <TableHead className="text-right">{t('pricing.buybox.lowestCompetitor')}</TableHead>
                  <TableHead className="text-right">{t('pricing.buybox.optimalPrice')}</TableHead>
                  <TableHead>{t('pricing.buybox.buyboxStatus')}</TableHead>
                  <TableHead>{t('pricing.buybox.recommendation')}</TableHead>
                  <TableHead className="text-right">{t('pricing.buybox.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      {t('pricing.buybox.noRows')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const status = buyBoxBadge(row);
                    return (
                      <TableRow key={row.listingId}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(row.listingId)}
                            onCheckedChange={(c) => toggleRow(row.listingId, c === true)}
                            aria-label={row.title}
                          />
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="line-clamp-2 text-sm font-medium">{row.title}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {row.barcode}
                          </span>
                        </TableCell>
                        <TableCell>{marketplacePlatformLabel(row.platform)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.currentPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.lowestCompetitorPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-sky-700 dark:text-sky-400">
                          {formatTry(optimalPrice(row))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={status === 'winning' ? 'default' : status === 'losing' ? 'outline' : 'secondary'}
                            className={cn(statusBadgeClass[status])}
                          >
                            {statusLabels[status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[180px] text-sm text-muted-foreground">
                          {recommendation(row)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={bulkPriceMutation.isPending}
                            onClick={() => {
                              bulkPriceMutation.mutate([
                                { id: row.listingId, price: optimalPrice(row) },
                              ]);
                            }}
                          >
                            {t('pricing.common.apply')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}
