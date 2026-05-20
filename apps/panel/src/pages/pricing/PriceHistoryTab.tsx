import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { TableSkeleton } from '@/components/TableSkeleton';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { getApiErrorMessage } from '@/lib/api';
import { useListings } from '@/pages/listings/hooks/useListings';
import type { OrgPlanTier } from '@/types/auth';
import type { ListingPriceHistoryItem, PriceHistoryEntry } from '@/types/pricing';

import { useListingPriceHistory, usePriceHistory } from './hooks/usePricing';
import { REASON_LABELS, formatTry, pctChange } from './pricing-utils';

type ChangeDirection = 'all' | 'up' | 'down';

function mapReason(source: string, reason: string | null): string {
  const key = (reason ?? source).toLowerCase();
  if (key.includes('buybox') || key.includes('buy_box')) {
    return 'BuyBox';
  }
  if (key.includes('rule') || key.includes('kural')) {
    return 'Kural';
  }
  if (key.includes('manual') || key.includes('manuel')) {
    return 'Manuel';
  }
  return REASON_LABELS[source] ?? reason ?? source;
}

interface Props {
  proAccess: boolean;
  plan: OrgPlanTier | undefined;
}

export function PriceHistoryTab({ proAccess, plan }: Props): ReactElement {
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
        label: format(new Date(p.date), 'd MMM', { locale: tr }),
      })),
    [listingHistoryQuery.data?.chart],
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
        reason: mapReason(row.source, row.reason),
      }));
    }
    return (globalHistoryQuery.data?.items ?? []).map((row: PriceHistoryEntry) => ({
      id: row.id,
      appliedAt: row.appliedAt,
      oldPrice: row.oldPrice,
      newPrice: row.newPrice,
      changePct: pctChange(row.oldPrice, row.newPrice),
      platform: row.platform,
      reason: mapReason(row.reason ?? '', row.reason),
    }));
  }, [listingId, listingHistoryQuery.data, globalHistoryQuery.data?.items]);

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
        feature="Fiyat geçmişi"
        requiredPlan="PRO"
        currentPlan={plan}
        description="Ürün bazlı fiyat geçmişi ve grafikler PRO pakette açıktır."
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
          <Label>Ürün ara</Label>
          {listingsQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <SearchableCombobox
              options={comboboxOptions}
              value={listingId}
              onChange={(v) => setListingId(v)}
              placeholder="Listeleme seçin…"
              searchPlaceholder="Barkod veya ürün adı…"
              emptyLabel="Listeleme bulunamadı"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Ürün seçilmezse organizasyon genelindeki son değişiklikler listelenir.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger>
                <SelectValue />
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
            <Label htmlFor="date-from">Başlangıç</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-to">Bitiş</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Değişim yönü</Label>
            <Select
              value={changeDir}
              onValueChange={(v) => setChangeDir(v as ChangeDirection)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="up">Artış</SelectItem>
                <SelectItem value="down">Azalış</SelectItem>
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
            · Güncel: {formatTry(listingHistoryQuery.data.currentPrice)}
          </span>
        </div>
      ) : null}

      {listingId && chartData.length > 0 ? (
        <div className="rounded-md border p-4">
          <p className="mb-3 text-sm font-medium">Fiyat zaman serisi (son 30 gün)</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip formatter={(v) => formatTry(typeof v === 'number' ? v : null)} />
                <Area
                  type="monotone"
                  dataKey="ourPrice"
                  name="Bizim fiyat"
                  stroke="#0ea5e9"
                  fill="url(#priceFill)"
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : null}

      {(listingId != null && listingHistoryQuery.isError) ||
      (listingId == null && globalHistoryQuery.isError) ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(
            listingHistoryQuery.error ?? globalHistoryQuery.error,
          )}
        </div>
      ) : null}

      {!isLoading && filteredRows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Seçilen filtrelere uygun fiyat geçmişi yok.
        </p>
      ) : null}

      {!isLoading && filteredRows.length > 0 ? (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Eski fiyat</TableHead>
                <TableHead>Yeni fiyat</TableHead>
                <TableHead>Değişim %</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Neden</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(row.appliedAt), 'd MMM yyyy HH:mm', { locale: tr })}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatTry(row.oldPrice)}</TableCell>
                  <TableCell className="tabular-nums">{formatTry(row.newPrice)}</TableCell>
                  <TableCell>
                    {row.changePct === 0 ? (
                      '—'
                    ) : (
                      <Badge
                        variant="outline"
                        className={
                          row.changePct < 0
                            ? 'border-green-500 text-green-700'
                            : 'border-red-500 text-red-700'
                        }
                      >
                        {row.changePct > 0 ? '+' : ''}
                        {row.changePct.toFixed(1)}%
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{row.platform}</TableCell>
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
