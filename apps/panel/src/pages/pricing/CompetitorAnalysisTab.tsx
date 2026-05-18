import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { CompetitorPriceRow, PriceGapPlatformRow } from '@/types/pricing';

import {
  useCompetitorPrices,
  useManualPricingUpdate,
  usePriceGap,
  usePriceTrend,
} from './hooks/usePricing';

const money = (n: number | null | undefined): string =>
  n == null || Number.isNaN(n)
    ? '—'
    : new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        maximumFractionDigits: 2,
      }).format(n);

interface Props {
  proAccess: boolean;
}

export function CompetitorAnalysisTab({ proAccess }: Props): ReactElement {
  const [input, setInput] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);

  const compQuery = useCompetitorPrices(active, proAccess);
  const gapQuery = usePriceGap(active, proAccess);
  const trendQuery = usePriceTrend(active, platform, proAccess);
  const manualMutation = useManualPricingUpdate();

  useEffect(() => {
    const p = gapQuery.data?.platforms?.[0]?.platform;
    if (p && platform === null) {
      setPlatform(p);
    }
  }, [gapQuery.data, platform]);

  const byPlatform = useMemo(() => {
    const map = new Map<string, CompetitorPriceRow[]>();
    for (const row of compQuery.data ?? []) {
      const list = map.get(row.platform) ?? [];
      list.push(row);
      map.set(row.platform, list);
    }
    return map;
  }, [compQuery.data]);

  const chartData = useMemo(() => {
    return (trendQuery.data ?? []).map((d) => ({
      ...d,
      label: d.date,
    }));
  }, [trendQuery.data]);

  const onSearch = (): void => {
    const b = input.trim();
    if (!b) {
      return;
    }
    setActive(b);
    setPlatform(null);
  };

  const equalize = (row: PriceGapPlatformRow): void => {
    if (active == null || row.buyBoxPrice == null || row.ourSalePrice == null) {
      return;
    }
    const list =
      row.ourListPrice != null
        ? Math.max(row.ourListPrice, row.buyBoxPrice)
        : row.buyBoxPrice;
    manualMutation.mutate({
      barcode: active,
      platform: row.platform,
      salePrice: row.buyBoxPrice,
      listPrice: list,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-primary">Rakip fiyat analizi</h2>
        <p className="text-sm text-muted-foreground">
          Barkod girerek rakip fiyatlarını, BuyBox farkını ve son 7 gün trendini görüntüleyin.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="barcode-search">Barkod</Label>
          <Input
            id="barcode-search"
            placeholder="8680000000001"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
          />
        </div>
        <Button type="button" onClick={onSearch}>
          Sorgula
        </Button>
      </div>

      {active ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Platform özeti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {gapQuery.isLoading ? <Skeleton className="h-28 w-full" /> : null}
              {gapQuery.isError ? (
                <p className="text-sm text-destructive">{getApiErrorMessage(gapQuery.error)}</p>
              ) : null}
              {gapQuery.data && gapQuery.data.platforms.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu barkod için listeleme bulunamadı.</p>
              ) : null}
              {gapQuery.data && gapQuery.data.platforms.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Bizim</TableHead>
                      <TableHead className="text-right">BuyBox</TableHead>
                      <TableHead className="text-right">Fark (₺)</TableHead>
                      <TableHead className="text-right">Fark (%)</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gapQuery.data.platforms.map((row) => (
                      <TableRow key={row.platform}>
                        <TableCell className="font-medium">{row.platform}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(row.ourSalePrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(row.buyBoxPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.gapTry != null ? money(row.gapTry) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.gapPct != null ? `%${row.gapPct.toFixed(1)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={
                              row.buyBoxPrice == null ||
                              manualMutation.isPending ||
                              row.ourSalePrice == null
                            }
                            onClick={() => {
                              equalize(row);
                            }}
                          >
                            BuyBox&apos;a eşitle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>

          <div className="max-w-xs space-y-2">
            <Label>Trend platformu</Label>
            <Select
              value={platform ?? undefined}
              onValueChange={(v) => {
                setPlatform(v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Platform seçin" />
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
              <CardTitle className="text-base">Son 7 gün fiyat trendi</CardTitle>
            </CardHeader>
            <CardContent>
              {trendQuery.isLoading ? <Skeleton className="h-72 w-full" /> : null}
              {trendQuery.isError ? (
                <p className="text-sm text-destructive">{getApiErrorMessage(trendQuery.error)}</p>
              ) : null}
              {trendQuery.data && trendQuery.data.length > 0 && platform ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                      <Tooltip
                        formatter={(value) =>
                          typeof value === 'number'
                            ? money(value)
                            : String(value ?? '')
                        }
                      />
                      <Legend />
                      <Line type="monotone" dataKey="ourPrice" name="Bizim" stroke="#0ea5e9" dot={false} />
                      <Line
                        type="monotone"
                        dataKey="buyBoxPrice"
                        name="BuyBox"
                        stroke="#64748b"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgCompetitorPrice"
                        name="Rakip ort."
                        stroke="#f97316"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
              {platform && !trendQuery.isLoading && (trendQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Trend verisi yok.</p>
              ) : null}
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
              {!compQuery.isLoading &&
              !compQuery.isError &&
              (compQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Henüz rakip fiyat kaydı yok. Pazaryeri senkronu sonrası burada görünecek.
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
                            {money(Number(r.price))}
                          </TableCell>
                          <TableCell>{r.isBuyBox ? 'Evet' : 'Hayır'}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
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
      ) : (
        <p className="text-sm text-muted-foreground">Analiz için barkod sorgulayın.</p>
      )}
    </div>
  );
}
