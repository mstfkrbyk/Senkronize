import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { getApiErrorMessage } from '@/lib/api';
import { useBulkListingPrice } from '@/pages/listings/hooks/useListings';
import type { BuyBoxReportTopLoser } from '@/types/pricing';

import {
  useBuyBoxReport,
  useBuyBoxSummary,
  useBuyBoxWinRate,
} from './hooks/usePricing';
import { formatTry } from './pricing-utils';

type BuyBoxStatusFilter = 'all' | 'winning' | 'losing' | 'competitive';

function buyBoxBadge(row: BuyBoxReportTopLoser): {
  label: string;
  variant: 'default' | 'secondary' | 'outline';
  className?: string;
} {
  if (row.isWinner) {
    return { label: 'Kazanıyor', variant: 'default', className: 'bg-green-600 hover:bg-green-600/90' };
  }
  const gapPct =
    row.buyBoxReferencePrice > 0
      ? (row.priceGap / row.buyBoxReferencePrice) * 100
      : 100;
  if (gapPct <= 3) {
    return { label: 'Rekabetçi', variant: 'secondary' };
  }
  return { label: 'Kaybediyor', variant: 'outline', className: 'border-amber-500 text-amber-700' };
}

function recommendation(row: BuyBoxReportTopLoser): string {
  if (row.isWinner) {
    return 'BuyBox sende — fiyatı koruyun';
  }
  const target = row.buyBoxReferencePrice;
  if (row.priceGap > 0) {
    return `${formatTry(target)} seviyesine indirin`;
  }
  return 'Rakip fiyatını izleyin';
}

interface Props {
  proAccess: boolean;
  plan: string | undefined;
}

export function BuyBoxTab({ proAccess, plan }: Props): ReactElement {
  const reportQuery = useBuyBoxReport(proAccess);
  const summaryQuery = useBuyBoxSummary(proAccess);
  const winRateQuery = useBuyBoxWinRate(7, proAccess);
  const bulkPriceMutation = useBulkListingPrice();

  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<BuyBoxStatusFilter>('all');
  const [gapMin, setGapMin] = useState('');
  const [gapMax, setGapMax] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const rows = useMemo(() => reportQuery.data?.topLosers ?? [], [reportQuery.data?.topLosers]);

  const filteredRows = useMemo(() => {
    const min = gapMin.trim() === '' ? null : Number.parseFloat(gapMin.replace(',', '.'));
    const max = gapMax.trim() === '' ? null : Number.parseFloat(gapMax.replace(',', '.'));

    return rows.filter((row) => {
      if (platformFilter !== 'all' && row.platform !== platformFilter) {
        return false;
      }
      const badge = buyBoxBadge(row);
      if (statusFilter === 'winning' && badge.label !== 'Kazanıyor') {
        return false;
      }
      if (statusFilter === 'losing' && badge.label !== 'Kaybediyor') {
        return false;
      }
      if (statusFilter === 'competitive' && badge.label !== 'Rekabetçi') {
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
      toast.error('En az bir ürün seçin');
      return;
    }
    bulkPriceMutation.mutate(
      selected.map((r) => ({
        id: r.listingId,
        price: r.buyBoxReferencePrice,
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
        feature="BuyBox durumu"
        requiredPlan="PRO"
        currentPlan={plan}
        description="BuyBox KPI, ürün tablosu ve otomatik fiyat uygulama PRO ve Kurumsal paketlerde açıktır."
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
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(reportQuery.error)}
        </div>
      ) : null}

      {reportQuery.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  BuyBox kazanma oranı
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-sky-600 tabular-nums">
                  %{(reportQuery.data.winRate * 100).toFixed(1)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reportQuery.data.buyBoxCount} / {reportQuery.data.totalListings} listeleme
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Kazanılan ürün
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-green-700">
                  {summaryQuery.data?.winningBuyBox ?? reportQuery.data.buyBoxCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Kaybedilen ürün
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-amber-700">
                  {rows.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ort. fiyat sapması
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatTry(avgDeviation)}
                </p>
                {winRateQuery.data ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kazanırken: {formatTry(winRateQuery.data.avgPriceWhenWinning)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {platforms.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Durum</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as BuyBoxStatusFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="winning">Kazanıyor</SelectItem>
                    <SelectItem value="losing">Kaybediyor</SelectItem>
                    <SelectItem value="competitive">Rekabetçi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gap-min">Sapma min (₺)</Label>
                <Input
                  id="gap-min"
                  inputMode="decimal"
                  placeholder="0"
                  value={gapMin}
                  onChange={(e) => setGapMin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gap-max">Sapma max (₺)</Label>
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
              Otomatik fiyat uygula
              {selectedIds.size > 0 ? ` (${String(selectedIds.size)})` : ''}
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
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
                      aria-label="Tümünü seç"
                    />
                  </TableHead>
                  <TableHead>Ürün</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Bizim fiyat</TableHead>
                  <TableHead className="text-right">En düşük rakip</TableHead>
                  <TableHead>BuyBox durumu</TableHead>
                  <TableHead>Öneri</TableHead>
                  <TableHead className="text-right">Aksiyonlar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Filtrelere uygun kayıt yok.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const badge = buyBoxBadge(row);
                    return (
                      <TableRow key={row.listingId}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(row.listingId)}
                            onCheckedChange={(c) => toggleRow(row.listingId, c === true)}
                            aria-label={`${row.title} seç`}
                          />
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="line-clamp-2 text-sm font-medium">{row.title}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {row.barcode}
                          </span>
                        </TableCell>
                        <TableCell>{row.platform}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.currentPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTry(row.lowestCompetitorPrice)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant} className={badge.className}>
                            {badge.label}
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
                                { id: row.listingId, price: row.buyBoxReferencePrice },
                              ]);
                            }}
                          >
                            Uygula
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
