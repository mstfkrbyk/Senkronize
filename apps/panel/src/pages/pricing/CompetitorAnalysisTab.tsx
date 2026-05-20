import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Bell } from 'lucide-react';
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
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { getApiErrorMessage } from '@/lib/api';
import { useListings } from '@/pages/listings/hooks/useListings';
import type { OrgPlanTier } from '@/types/auth';
import type { CompetitorPriceRow } from '@/types/pricing';

import {
  useCompetitorPrices,
  useCreatePriceAlert,
  useListingPriceHistory,
  usePriceGap,
  usePriceTrend,
} from './hooks/usePricing';
import { formatTry } from './pricing-utils';

interface Props {
  proAccess: boolean;
  plan: OrgPlanTier | undefined;
}

export function CompetitorAnalysisTab({ proAccess, plan }: Props): ReactElement {
  const listingsQuery = useListings({ page: 1, limit: 200 }, proAccess);
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
  const compQuery = useCompetitorPrices(barcode, proAccess);
  const gapQuery = usePriceGap(barcode, proAccess);
  const trendQuery = usePriceTrend(barcode, platform, proAccess);
  const historyQuery = useListingPriceHistory(listingId, 30, proAccess);
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
        label: format(new Date(p.date), 'd MMM', { locale: tr }),
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
  }, [historyQuery.data?.chart, trendQuery.data]);

  const byPlatform = useMemo(() => {
    const map = new Map<string, CompetitorPriceRow[]>();
    for (const row of compQuery.data ?? []) {
      const list = map.get(row.platform) ?? [];
      list.push(row);
      map.set(row.platform, list);
    }
    return map;
  }, [compQuery.data]);

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
        feature="Rakip analizi"
        requiredPlan="PRO"
        currentPlan={plan}
        description="Rakip fiyat tablosu, trend grafiği ve uyarılar PRO pakette açıktır."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-xl space-y-2">
        <Label>Ürün seçin</Label>
        {listingsQuery.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <SearchableCombobox
            options={comboboxOptions}
            value={listingId}
            onChange={setListingId}
            placeholder="Listeleme seçin…"
            searchPlaceholder="Barkod veya ürün adı…"
          />
        )}
      </div>

      {listingId == null ? (
        <p className="text-sm text-muted-foreground">
          Rakip fiyatları ve trend için bir ürün seçin.
        </p>
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
              Fiyat uyarısı ekle
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
                        <span className="text-muted-foreground">En ucuz</span>
                        <span className="font-semibold tabular-nums">{cheapest}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bizim fiyat</span>
                        <span className="tabular-nums">{formatTry(row.ourSalePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rakip sayısı</span>
                        <span>{row.competitorCount}</span>
                      </div>
                      {row.gapPct != null ? (
                        <Badge variant={row.gapPct > 0 ? 'outline' : 'default'}>
                          Fark %{row.gapPct.toFixed(1)}
                        </Badge>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}

          <div className="max-w-xs space-y-2">
            <Label>Trend platformu</Label>
            <Select
              value={platform ?? undefined}
              onValueChange={(v) => setPlatform(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Platform" />
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
              <CardTitle className="text-base">Fiyat trendi</CardTitle>
              <p className="text-sm text-muted-foreground">
                Son 30 gün (ürün geçmişi) veya API&apos;deki son 7 gün anlık görüntüleri
              </p>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading || trendQuery.isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : null}
              {chartData.length > 0 ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v) => formatTry(typeof v === 'number' ? v : null)} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="ourPrice"
                        name="Bizim"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="rakip1"
                        name={topCompetitors[0]?.competitorName ?? 'Rakip 1'}
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="rakip2"
                        name={topCompetitors[1]?.competitorName ?? 'Rakip 2'}
                        stroke="#64748b"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Trend verisi yok.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rakip fiyat tablosu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {compQuery.isLoading ? <Skeleton className="h-40 w-full" /> : null}
              {compQuery.isError ? (
                <p className="text-sm text-destructive">{getApiErrorMessage(compQuery.error)}</p>
              ) : null}
              {(compQuery.data?.length ?? 0) === 0 && !compQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Henüz rakip fiyat kaydı yok.
                </p>
              ) : null}
              {Array.from(byPlatform.entries()).map(([plat, rows]) => (
                <div key={plat} className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{plat}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Satıcı</TableHead>
                        <TableHead className="text-right">Fiyat</TableHead>
                        <TableHead>BuyBox</TableHead>
                        <TableHead>Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            {r.competitorName ?? r.competitorId}
                            {r.isBuyBox ? (
                              <Badge className="ml-2 bg-sky-500 text-white hover:bg-sky-500/90">
                                BuyBox
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(Number(r.price))}
                          </TableCell>
                          <TableCell>{r.isBuyBox ? 'Evet' : 'Hayır'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(r.capturedAt).toLocaleString('tr-TR')}
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
            <DialogTitle>Fiyat uyarısı</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="alert-threshold">Eşik fiyat (₺)</Label>
              <Input
                id="alert-threshold"
                inputMode="decimal"
                placeholder="Örn. 299,90"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="alert-email">E-posta</Label>
              <Switch
                id="alert-email"
                checked={alertEmail}
                onCheckedChange={setAlertEmail}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="alert-inapp">Panel bildirimi</Label>
              <Switch
                id="alert-inapp"
                checked={alertInApp}
                onCheckedChange={setAlertInApp}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAlertOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={createAlert.isPending}
              onClick={handleCreateAlert}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
