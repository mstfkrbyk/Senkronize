import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { getApiErrorMessage } from '@/lib/api';
import type { BuyBoxReportTopLoser, PriceSimulationResult } from '@/types/pricing';

import {
  useBuyBoxReport,
  useManualPricingUpdate,
  usePriceTrend,
  useSimulatePrice,
} from './hooks/usePricing';

const tryFmt = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});

interface Props {
  proAccess: boolean;
}

export function BuyBoxAnalysisTab({ proAccess }: Props): ReactElement {
  const reportQuery = useBuyBoxReport(proAccess);
  const [selected, setSelected] = useState<BuyBoxReportTopLoser | null>(null);
  const trendQuery = usePriceTrend(
    selected?.barcode ?? null,
    selected?.platform ?? null,
    proAccess && selected != null,
  );

  const [simOpen, setSimOpen] = useState(false);
  const [simListing, setSimListing] = useState<BuyBoxReportTopLoser | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [simResult, setSimResult] = useState<PriceSimulationResult | null>(null);

  const simulateMut = useSimulatePrice();
  const manualMut = useManualPricingUpdate();

  useEffect(() => {
    if (
      reportQuery.data?.topLosers.length &&
      selected === null &&
      reportQuery.data.topLosers[0]
    ) {
      setSelected(reportQuery.data.topLosers[0]);
    }
  }, [reportQuery.data?.topLosers, selected]);

  const gaugeData = useMemo(() => {
    const pct = reportQuery.data
      ? Math.min(100, Math.round(reportQuery.data.winRate * 10_000) / 100)
      : 0;
    return [{ name: 'win', value: pct, fill: '#38bdf8' }];
  }, [reportQuery.data]);

  const chartData = useMemo(() => {
    return (trendQuery.data ?? []).map((p) => ({
      ...p,
      label: p.date.slice(5).replace('-', '/'),
    }));
  }, [trendQuery.data]);

  const openSimulate = (row: BuyBoxReportTopLoser): void => {
    setSimListing(row);
    setPriceInput(String(row.currentPrice));
    setSimResult(null);
    setSimOpen(true);
  };

  const runSimulate = (): void => {
    if (!simListing) {
      return;
    }
    const n = Number.parseFloat(priceInput.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      return;
    }
    simulateMut.mutate(
      { listingId: simListing.listingId, salePrice: n },
      {
        onSuccess: (data) => {
          setSimResult(data);
        },
      },
    );
  };

  const applyPrice = (): void => {
    if (!simListing || simResult === null) {
      return;
    }
    const list = Math.round(simResult.simulatedPrice * 1.02 * 100) / 100;
    manualMut.mutate(
      {
        barcode: simListing.barcode,
        platform: simListing.platform,
        salePrice: simResult.simulatedPrice,
        listPrice: list,
      },
      {
        onSuccess: () => {
          setSimOpen(false);
          void reportQuery.refetch();
          void trendQuery.refetch();
        },
      },
    );
  };

  if (!proAccess) {
    return (
      <p className="text-sm text-muted-foreground">
        Bu sekme PRO veya Kurumsal pakette kullanılabilir.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {reportQuery.isLoading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
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
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>BuyBox kazanma oranı</CardTitle>
                <CardDescription>
                  Son 7 gündeki anlık görüntülere göre listelemelerinizde BuyBox payı
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <div className="h-52 w-52 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="68%"
                      outerRadius="100%"
                      data={gaugeData}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={8} background />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-4xl font-semibold text-sky-600 tabular-nums">
                    %{gaugeData[0]?.value.toFixed(1) ?? '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reportQuery.data.buyBoxCount} / {reportQuery.data.totalListings}{' '}
                    listeleme BuyBox&apos;ta
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tahmini günlük gelir kaçağı (basit model):{' '}
                    <span className="font-medium text-foreground tabular-nums">
                      {tryFmt.format(reportQuery.data.potentialRevenueLoss)}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rakip fiyat trendi (7 gün)</CardTitle>
                <CardDescription>
                  Tablodan veya listeden bir kaybeden seçin; grafik barkod + platform için
                  yüklenir.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selected ? (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Seçili:{' '}
                    <span className="font-medium text-foreground">{selected.title}</span>{' '}
                    — {selected.platform}
                  </p>
                ) : (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Grafik için tablodan bir ürün seçin.
                  </p>
                )}
                {trendQuery.isLoading ? (
                  <Skeleton className="h-64 w-full rounded-lg" />
                ) : null}
                {trendQuery.isError ? (
                  <QueryErrorAlert
                    error={trendQuery.error}
                    onRetry={() => {
                      void trendQuery.refetch();
                    }}
                  />
                ) : null}
                {trendQuery.data && trendQuery.data.length > 0 ? (
                  <div className="h-72 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          domain={['auto', 'auto']}
                          tickFormatter={(v: unknown) =>
                            `${typeof v === 'number' ? v : String(v ?? '')}`
                          }
                        />
                        <Tooltip
                          formatter={(value: unknown) => [
                            typeof value === 'number'
                              ? tryFmt.format(value)
                              : String(value ?? ''),
                            '',
                          ]}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="ourPrice"
                          name="Bizim fiyat"
                          stroke="#0f172a"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="buyBoxPrice"
                          name="BuyBox ref."
                          stroke="#38bdf8"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="avgCompetitorPrice"
                          name="Ort. rakip"
                          stroke="#94a3b8"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
                {!trendQuery.isLoading &&
                !trendQuery.isError &&
                selected &&
                (trendQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Bu ürün için trend verisi yok.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>En çok kaybedenler</CardTitle>
              <CardDescription>
                BuyBox dışı kalan listelemeler ve basit gelir kaçağı tahmini
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {reportQuery.data.topLosers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Kayıp listeleme yok veya henüz yeterli BuyBox verisi yok.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ürün</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Fiyat farkı</TableHead>
                      <TableHead className="text-right">Kaçak (tahmin)</TableHead>
                      <TableHead className="text-right w-[1%] whitespace-nowrap" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportQuery.data.topLosers.map((row) => (
                      <TableRow
                        key={row.listingId}
                        className={
                          selected?.listingId === row.listingId ? 'bg-sky-50/60' : undefined
                        }
                      >
                        <TableCell className="max-w-[220px]">
                          <button
                            type="button"
                            className="text-left text-sm font-medium text-primary hover:underline"
                            onClick={() => {
                              setSelected(row);
                            }}
                          >
                            {row.title.length > 48 ? `${row.title.slice(0, 48)}…` : row.title}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.platform}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {tryFmt.format(row.priceGap)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {tryFmt.format(row.potentialRevenueLoss)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              openSimulate(row);
                            }}
                          >
                            Fiyatı optimize et
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fiyat simülasyonu</DialogTitle>
          </DialogHeader>
          {simListing ? (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground line-clamp-2">{simListing.title}</p>
              <div className="space-y-2">
                <Label htmlFor="sim-price">Yeni satış fiyatı (TRY)</Label>
                <Input
                  id="sim-price"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => {
                    setPriceInput(e.target.value);
                    setSimResult(null);
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={simulateMut.isPending}
                onClick={() => {
                  runSimulate();
                }}
              >
                {simulateMut.isPending ? 'Hesaplanıyor…' : 'Hesapla'}
              </Button>
              {simulateMut.isError ? (
                <p className="text-sm text-destructive">
                  {getApiErrorMessage(simulateMut.error)}
                </p>
              ) : null}
              {simResult ? (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Tahmini BuyBox ihtimali</span>
                    <span className="font-medium tabular-nums">
                      %{(simResult.estimatedBuyBoxProbability * 100).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Marj (mevcut)</span>
                    <span className="tabular-nums">
                      {simResult.marginImpact.currentMarginPct != null
                        ? `%${simResult.marginImpact.currentMarginPct.toFixed(1)}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Marj (yeni)</span>
                    <span className="tabular-nums">
                      {simResult.marginImpact.simulatedMarginPct != null
                        ? `%${simResult.marginImpact.simulatedMarginPct.toFixed(1)}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">7 günlük gelir etkisi (tahmin)</span>
                    <span className="font-medium tabular-nums">
                      {tryFmt.format(simResult.estimatedRevenueDelta)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSimOpen(false)}>
              Kapat
            </Button>
            <Button
              type="button"
              disabled={simResult === null || manualMut.isPending}
              onClick={() => {
                applyPrice();
              }}
            >
              {manualMut.isPending ? 'Uygulanıyor…' : 'Uygula'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
