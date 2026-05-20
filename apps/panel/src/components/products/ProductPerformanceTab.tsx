import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, Trophy } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PlatformSalesChart } from '@/components/products/PlatformSalesChart';
import { variantLabel } from '@/components/products/variant-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getApiErrorMessage } from '@/lib/api';
import type {
  OrdersResponse,
} from '@/types/order';
import type {
  ProductAnalyticsResponse,
  ProductDetailListing,
  ProductVariantDto,
} from '@/types/product';

interface Props {
  productId: string;
  productBarcode: string;
  variants: ProductVariantDto[];
  listings: ProductDetailListing[];
}

type PeriodDays = 30 | 90;

interface BuyBoxStatus {
  listingId: string;
  platform: string;
  isWinner: boolean;
}

function formatTry(value: number): string {
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

async function fetchVariantSales(
  barcodes: Map<string, string>,
  since: Date,
): Promise<Map<string, number>> {
  const sales = new Map<string, number>();
  for (const id of barcodes.keys()) {
    sales.set(id, 0);
  }

  let page = 1;
  const limit = 100;
  let total = Infinity;

  while ((page - 1) * limit < total) {
    const { data } = await api.get<OrdersResponse>('/orders', {
      params: {
        startDate: since.toISOString(),
        page,
        limit,
      },
    });
    total = data.total;
    for (const order of data.items) {
      if (order.status === 'RETURNED') {
        continue;
      }
      for (const item of order.items) {
        const variantId = barcodes.get(item.barcode);
        if (variantId) {
          sales.set(variantId, (sales.get(variantId) ?? 0) + item.quantity);
        }
      }
    }
    if (data.items.length === 0) {
      break;
    }
    page += 1;
    if (page > 20) {
      break;
    }
  }

  return sales;
}

export function ProductPerformanceTab({
  productId,
  productBarcode,
  variants,
  listings,
}: Props): ReactElement {
  const [days, setDays] = useState<PeriodDays>(30);

  const analyticsQuery = useQuery({
    queryKey: ['product-analytics', productId, days],
    queryFn: async (): Promise<ProductAnalyticsResponse> => {
      const { data } = await api.get<ProductAnalyticsResponse>(
        `/products/${productId}/analytics`,
        { params: { days } },
      );
      return data;
    },
  });

  const barcodeToVariantId = useMemo(() => {
    const map = new Map<string, string>();
    map.set(productBarcode, 'product');
    for (const v of variants) {
      if (v.barcode) {
        map.set(v.barcode, v.id);
      }
    }
    return map;
  }, [productBarcode, variants]);

  const variantSalesQuery = useQuery({
    queryKey: ['product-variant-sales', productId, days, variants.length],
    enabled: variants.length > 0 || Boolean(productBarcode),
    queryFn: async () => {
      const since = subDays(new Date(), days);
      since.setHours(0, 0, 0, 0);
      return fetchVariantSales(barcodeToVariantId, since);
    },
  });

  const buyBoxQuery = useQuery({
    queryKey: ['product-buybox', productId, listings.map((l) => l.id).join(',')],
    enabled: listings.length > 0,
    queryFn: async (): Promise<BuyBoxStatus[]> => {
      const results = await Promise.all(
        listings.map(async (listing) => {
          try {
            const { data } = await api.get<{ isWinner: boolean }>(
              `/pricing/buybox-status/${listing.id}`,
            );
            return {
              listingId: listing.id,
              platform: listing.platform,
              isWinner: data.isWinner,
            };
          } catch {
            return {
              listingId: listing.id,
              platform: listing.platform,
              isWinner: false,
            };
          }
        }),
      );
      return results;
    },
  });

  if (analyticsQuery.isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Performans verileri yükleniyor…
      </div>
    );
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <p className="text-destructive text-sm">
        {analyticsQuery.isError
          ? getApiErrorMessage(analyticsQuery.error)
          : 'Veri yok'}
      </p>
    );
  }

  const { dailySales, kpis, platformDistribution } = analyticsQuery.data;

  const salesChart = dailySales.map((d) => ({
    label: format(parseISO(d.date), 'd MMM', { locale: tr }),
    quantity: d.quantity,
    revenue: d.revenue,
  }));

  const topVariants = [...variants]
    .map((v) => ({
      variant: v,
      sales: variantSalesQuery.data?.get(v.id) ?? 0,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10);

  const buyBoxWinners = buyBoxQuery.data?.filter((b) => b.isWinner).length ?? 0;
  const buyBoxTotal = buyBoxQuery.data?.length ?? 0;
  const buyBoxWinRate =
    buyBoxTotal > 0
      ? Math.round((buyBoxWinners / buyBoxTotal) * 1000) / 10
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Satış trendi ve platform dağılımı
        </p>
        <div className="flex gap-1 rounded-lg border p-1">
          {([30, 90] as const).map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={days === d ? 'secondary' : 'ghost'}
              className="h-8"
              onClick={() => {
                setDays(d);
              }}
            >
              {d} gün
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Toplam satış</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {kpis.totalSales.toLocaleString('tr-TR')}
            </CardTitle>
            <p className="text-muted-foreground text-xs">Son {days} gün</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Toplam gelir</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatTry(kpis.totalRevenue)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Günlük ort. satış</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {kpis.averageDailySales.toLocaleString('tr-TR')}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Trophy className="size-3.5" />
              BuyBox kazanma oranı
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {buyBoxWinRate !== null ? `%${buyBoxWinRate}` : '—'}
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              {buyBoxTotal > 0
                ? `${buyBoxWinners} / ${buyBoxTotal} listing`
                : 'Listing yok'}
            </p>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Satış trendi</CardTitle>
          <CardDescription>Son {days} gün satış adedi</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {salesChart.length === 0 ? (
            <p className="text-muted-foreground text-sm">Satış verisi yok.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'Gelir') {
                      return [formatTry(Number(value)), name];
                    }
                    return [value, name];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="quantity"
                  name="Adet"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform dağılımı</CardTitle>
            <CardDescription>Satış adedi ve gelir payı</CardDescription>
          </CardHeader>
          <CardContent>
            <PlatformSalesChart platforms={platformDistribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">En çok satılan varyantlar</CardTitle>
            <CardDescription>Son {days} gün, barkoda göre</CardDescription>
          </CardHeader>
          <CardContent>
            {variantSalesQuery.isLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Varyant satışları hesaplanıyor…
              </div>
            ) : topVariants.length === 0 ? (
              <p className="text-muted-foreground text-sm">Varyant yok.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Varyant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Satış</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topVariants.map(({ variant, sales }, index) => (
                    <TableRow key={variant.id}>
                      <TableCell className="text-sm">
                        {index === 0 && sales > 0 ? (
                          <Badge variant="secondary" className="mr-2">
                            #1
                          </Badge>
                        ) : null}
                        {variantLabel(variant)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {variant.sku}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {sales.toLocaleString('tr-TR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={variant.isActive ? 'default' : 'secondary'}>
                          {variant.isActive ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {buyBoxQuery.data && buyBoxQuery.data.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listing BuyBox durumu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {buyBoxQuery.data.map((row) => (
                <Badge
                  key={row.listingId}
                  variant={row.isWinner ? 'default' : 'outline'}
                >
                  {row.platform}: {row.isWinner ? 'Kazanan' : 'Kaybeden'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
