import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Bell } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/TableSkeleton';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useListings } from '@/pages/listings/hooks/useListings';
import type { OrgPlanTier } from '@/types/auth';
import type { CompetitorPriceRow } from '@/types/pricing';

import {
  useCompetitorMatrix,
  useCompetitorPrices,
  useCreatePriceAlert,
  useListingPriceHistory,
  usePriceGap,
  usePriceTrend,
} from './hooks/usePricing';
import { PRICING_CHART_COLORS, PRICING_CHART_GRID_CLASS } from './pricing-chart';
import { pricingDateLocale } from './pricing-i18n';
import { formatTry } from './pricing-utils';

interface Props {
  proAccess: boolean;
  plan: OrgPlanTier | undefined;
}

export function CompetitorAnalysisTab({ proAccess, plan }: Props): ReactElement {
  const { t, i18n } = useTranslation();
  const dateLocale = pricingDateLocale();
  const listingsQuery = useListings({ page: 1, limit: 200 }, proAccess);
  const matrixQuery = useCompetitorMatrix(proAccess);
  const [listingId, setListingId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState('');
  const [alertEmail, setAlertEmail] = useState(true);
  const [alertInApp, setAlertInApp] = useState(true);

  const selectedListing = useMemo(
    () => listingsQuery.data?.items.find((l) => l.id === listingId),
    [listingsQuery.data?.items, listingId],
  );

  const barcode = selectedListing?.barcode ?? null;
  const compQuery = useCompetitorPrices(barcode, proAccess && listingId != null);
  const gapQuery = usePriceGap(barcode, proAccess && listingId != null);
  const trendQuery = usePriceTrend(barcode, platform, proAccess && listingId != null);
  const historyQuery = useListingPriceHistory(listingId, 30, proAccess && listingId != null);
  const createAlert = useCreatePriceAlert();

  useEffect(() => {
    const p = gapQuery.data?.platforms?.[0]?.platform;
    if (p && platform === null) {
      setPlatform(p);
    }
  }, [gapQuery.data, platform]);

  useEffect(() => {
    setPlatform(null);
  }, [listingId]);

  const comboboxOptions = useMemo(
    () =>
      (listingsQuery.data?.items ?? []).map((l) => ({
        value: l.id,
        label: `${l.title.slice(0, 48)}${l.title.length > 48 ? '…' : ''} — ${l.barcode}`,
      })),
    [listingsQuery.data?.items],
  );

  const topCompetitors = useMemo(() => {
    const rows = compQuery.data ?? [];
    const byId = new Map<string, CompetitorPriceRow>();
    for (const row of rows) {
      if (row.isBuyBox) {
        continue;
      }
      const existing = byId.get(row.competitorId);
      if (!existing || Number(row.price) < Number(existing.price)) {
        byId.set(row.competitorId, row);
      }
    }
    return Array.from(byId.values())
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, 2);
  }, [compQuery.data]);

  const chartData = useMemo(() => {
    const history = historyQuery.data?.chart ?? [];
    if (history.length > 0) {
      return history.map((p) => ({
        label: format(new Date(p.date), 'd MMM', { locale: dateLocale }),
        ourPrice: p.ourPrice,
        rakip1: p.lowestCompetitor,
        rakip2: p.avgCompetitor,
      }));
    }
    return (trendQuery.data ?? []).map((d) => ({
      label: d.date,
      ourPrice: d.ourPrice,
      rakip1: d.buyBoxPrice,
      rakip2: d.avgCompetitorPrice,
    }));
  }, [historyQuery.data?.chart, trendQuery.data, dateLocale]);

  const byPlatform = useMemo(() => {
    const map = new Map<string, CompetitorPriceRow[]>();
    for (const row of compQuery.data ?? []) {
      const list = map.get(row.platform) ?? [];
      list.push(row);
      map.set(row.platform, list);
    }
    return map;
  }, [compQuery.data]);

  const matrixPlatforms = useMemo(() => {
    const set = new Set<string>();
    for (const row of matrixQuery.data ?? []) {
      for (const cell of row.platforms) {
        set.add(cell.platform);
      }
    }
    return Array.from(set).sort();
  }, [matrixQuery.data]);

  const handleCreateAlert = (): void => {
    const threshold = Number(alertThreshold.replace(',', '.'));
    if (listingId == null || Number.isNaN(threshold) || threshold <= 0) {
      return;
    }
    createAlert.mutate(
      {
        listingId,
        thresholdPrice: threshold,
        notifyEmail: alertEmail,
        notifyInApp: alertInApp,
      },
      {
        onSuccess: () => {
          setAlertOpen(false);
          setAlertThreshold('');
        },
      },
    );
  };

  if (!proAccess) {
    return (
      <UpgradePrompt
        feature={t('pricing.upgrade.competitorsFeature')}
        requiredPlan="PRO"
        currentPlan={plan}
        description={t('pricing.upgrade.competitorsDesc')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-xl space-y-2">
        <Label>{t('pricing.competitors.selectProduct')}</Label>
        {listingsQuery.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <SearchableCombobox
            options={comboboxOptions}
            value={listingId}
            onChange={setListingId}
            placeholder={t('pricing.competitors.selectPlaceholder')}
            searchPlaceholder={t('pricing.competitors.searchPlaceholder')}
          />
        )}
      </div>

      {listingId == null ? (
        <>
          <p className="text-sm text-muted-foreground">{t('pricing.competitors.selectHint')}</p>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('pricing.competitors.matrixTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('pricing.competitors.matrixDesc')}
              </p>
            </CardHeader>
            <CardContent>
              {matrixQuery.isLoading ? (
                <TableSkeleton rows={6} cols={matrixPlatforms.length + 2} />
              ) : null}
              {matrixQuery.isError ? (
                <p className="text-sm text-destructive">
                  {getApiErrorMessage(matrixQuery.error)}
                </p>
              ) : null}
              {!matrixQuery.isLoading && (matrixQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('pricing.competitors.noCompetitors')}
                </p>
              ) : null}
              {!matrixQuery.isLoading && (matrixQuery.data?.length ?? 0) > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('pricing.buybox.product')}</TableHead>
                        {matrixPlatforms.map((p) => (
                          <TableHead key={p} className="text-right">
                            {p}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">
                          {t('pricing.competitors.cheapest')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(matrixQuery.data ?? []).map((row) => (
                        <TableRow key={row.barcode}>
                          <TableCell className="max-w-[220px]">
                            <span className="line-clamp-2 text-sm font-medium">{row.title}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {row.barcode}
                            </span>
                          </TableCell>
                          {matrixPlatforms.map((plat) => {
                            const cell = row.platforms.find((c) => c.platform === plat);
                            return (
                              <TableCell key={plat} className="text-right text-sm tabular-nums">
                                {cell ? (
                                  <div className="space-y-0.5">
                                    <div>{formatTry(cell.ourPrice)}</div>
                                    <div
                                      className={cn(
                                        'text-xs',
                                        cell.isCheapest
                                          ? 'text-green-700 dark:text-green-400'
                                          : 'text-muted-foreground',
                                      )}
                                    >
                                      {cell.lowestCompetitor != null
                                        ? formatTry(cell.lowestCompetitor)
                                        : '—'}
                                    </div>
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-medium tabular-nums">
                            {row.globalLowest != null ? formatTry(row.globalLowest) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setAlertOpen(true)}
            >
              <Bell className="h-4 w-4" aria-hidden />
              {t('pricing.competitors.addAlert')}
            </Button>
          </div>

          {gapQuery.data && gapQuery.data.platforms.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gapQuery.data.platforms.map((row) => {
                const cheapest =
                  row.buyBoxPrice != null
                    ? formatTry(row.buyBoxPrice)
                    : row.ourSalePrice != null
                      ? formatTry(row.ourSalePrice)
                      : '—';
                return (
                  <Card key={row.platform}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{row.platform}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t('pricing.competitors.cheapest')}
                        </span>
                        <span className="font-semibold tabular-nums">{cheapest}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t('pricing.competitors.ourPrice')}
                        </span>
                        <span className="tabular-nums">{formatTry(row.ourSalePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t('pricing.competitors.competitorCount')}
                        </span>
                        <span>{row.competitorCount}</span>
                      </div>
                      {row.gapPct != null ? (
                        <Badge
                          variant={row.gapPct > 0 ? 'outline' : 'default'}
                          className={
                            row.gapPct > 0
                              ? 'border-amber-500 text-amber-700 dark:border-amber-600 dark:text-amber-400'
                              : undefined
                          }
                        >
                          {t('pricing.competitors.gapPct', { pct: row.gapPct.toFixed(1) })}
                        </Badge>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}

          <div className="max-w-xs space-y-2">
            <Label>{t('pricing.competitors.trendPlatform')}</Label>
            <Select value={platform ?? undefined} onValueChange={(v) => setPlatform(v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('pricing.common.platform')} />
              </SelectTrigger>
              <SelectContent>
                {(gapQuery.data?.platforms ?? []).map((p) => (
                  <SelectItem key={p.platform} value={p.platform}>
                    {p.platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('pricing.competitors.trendTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('pricing.competitors.trendDesc')}</p>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading || trendQuery.isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : null}
              {chartData.length > 0 ? (
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
                        name={t('pricing.competitors.us')}
                        stroke={PRICING_CHART_COLORS.our}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="rakip1"
                        name={topCompetitors[0]?.competitorName ?? t('pricing.competitors.competitor1')}
                        stroke={PRICING_CHART_COLORS.competitor1}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="rakip2"
                        name={topCompetitors[1]?.competitorName ?? t('pricing.competitors.competitor2')}
                        stroke={PRICING_CHART_COLORS.competitor2}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('pricing.common.noChartData')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('pricing.competitors.tableTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {compQuery.isLoading ? <Skeleton className="h-40 w-full" /> : null}
              {compQuery.isError ? (
                <p className="text-sm text-destructive">{getApiErrorMessage(compQuery.error)}</p>
              ) : null}
              {(compQuery.data?.length ?? 0) === 0 && !compQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  {t('pricing.competitors.noCompetitors')}
                </p>
              ) : null}
              {Array.from(byPlatform.entries()).map(([plat, rows]) => (
                <div key={plat} className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{plat}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('pricing.competitors.seller')}</TableHead>
                        <TableHead className="text-right">{t('pricing.competitors.price')}</TableHead>
                        <TableHead>{t('pricing.competitors.buybox')}</TableHead>
                        <TableHead>{t('pricing.competitors.date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            {r.competitorName ?? r.competitorId}
                            {r.isBuyBox ? (
                              <Badge className="ml-2 bg-sky-500 text-white hover:bg-sky-500/90 dark:bg-sky-600">
                                BuyBox
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(Number(r.price))}
                          </TableCell>
                          <TableCell>
                            {r.isBuyBox ? t('pricing.common.yes') : t('pricing.common.no')}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(r.capturedAt).toLocaleString(i18n.language)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pricing.competitors.alertTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="alert-threshold">{t('pricing.competitors.threshold')}</Label>
              <Input
                id="alert-threshold"
                inputMode="decimal"
                placeholder="299,90"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="alert-email">{t('pricing.competitors.email')}</Label>
              <Switch id="alert-email" checked={alertEmail} onCheckedChange={setAlertEmail} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="alert-inapp">{t('pricing.competitors.inApp')}</Label>
              <Switch id="alert-inapp" checked={alertInApp} onCheckedChange={setAlertInApp} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAlertOpen(false)}>
              {t('pricing.common.cancel')}
            </Button>
            <Button type="button" disabled={createAlert.isPending} onClick={handleCreateAlert}>
              {t('pricing.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
