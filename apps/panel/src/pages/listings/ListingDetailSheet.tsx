import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { StockBadge } from '@/components/StockBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Listing } from '@/types/listing';

import {
  useListingDetail,
  useUpdatePrice,
  useUpdateStock,
} from './hooks/useListings';

interface Props {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTryFromDecimal(value: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(Number(value));
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ListingDetailSheet({
  listing,
  open,
  onOpenChange,
}: Props): ReactElement {
  const detailQuery = useListingDetail(listing?.id ?? null, open);
  const updatePriceMutation = useUpdatePrice();
  const updateStockMutation = useUpdateStock();

  const active = detailQuery.data?.listing ?? listing;

  const [stockQty, setStockQty] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [listPrice, setListPrice] = useState('');

  useEffect(() => {
    if (!active) {
      return;
    }
    setStockQty(String(active.quantity));
    setSalePrice(String(active.salePrice));
    setListPrice(String(active.listPrice));
  }, [active]);

  const chartData = useMemo(() => {
    const pts = detailQuery.data?.priceHistory ?? [];
    return [...pts]
      .reverse()
      .map((p) => ({
        label: formatDate(p.appliedAt),
        fiyat: Number(p.newPrice),
      }));
  }, [detailQuery.data?.priceHistory]);

  const buyBox = detailQuery.data?.buyBox;
  const category = detailQuery.data?.category;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {listing ? (
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="text-left">
            <SheetTitle className="flex flex-wrap items-center gap-2">
              <span aria-hidden>
                {getMarketplaceBranding(active?.platform ?? listing.platform)
                  .logo}
              </span>
              <span className="line-clamp-2">
                {active?.title ?? listing.title}
              </span>
            </SheetTitle>
            <SheetDescription>
              {getMarketplaceBranding(active?.platform ?? listing.platform)
                .label}{' '}
              · Barkod{' '}
              <span className="font-mono">
                {active?.barcode ?? listing.barcode}
              </span>
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Platform</span>
              <Badge variant="outline" className="gap-1">
                <span aria-hidden>
                  {getMarketplaceBranding(active?.platform ?? listing.platform)
                    .logo}
                </span>
                {
                  getMarketplaceBranding(active?.platform ?? listing.platform)
                    .label
                }
              </Badge>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Kategori</p>
              {detailQuery.isLoading ? (
                <Skeleton className="mt-2 h-4 w-40" />
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {category?.trim() ? category : '—'}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Onay</span>
              {(active ?? listing).approved ? (
                <Badge
                  variant="outline"
                  className="border-green-200 bg-green-50 text-green-800"
                >
                  Onaylı
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-900"
                >
                  Beklemede
                </Badge>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">
                Mevcut fiyat ve stok
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Satış:{' '}
                <span className="font-semibold text-foreground">
                  {active
                    ? formatTryFromDecimal(active.salePrice)
                    : formatTryFromDecimal(listing.salePrice)}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Liste:{' '}
                <span className="font-semibold text-foreground">
                  {active
                    ? formatTryFromDecimal(active.listPrice)
                    : formatTryFromDecimal(listing.listPrice)}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Stok</span>
                <StockBadge quantity={active?.quantity ?? listing.quantity} />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">BuyBox</p>
              {detailQuery.isLoading ? (
                <Skeleton className="mt-2 h-6 w-32" />
              ) : buyBox ? (
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {buyBox.isWinner ? (
                      <Badge className="border-0 bg-emerald-600 text-white">
                        BuyBox kazanan
                      </Badge>
                    ) : (
                      <Badge variant="secondary">BuyBox dışı</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    BuyBox fiyatı:{' '}
                    <span className="font-medium text-foreground">
                      {formatTryFromDecimal(buyBox.buyBoxPrice)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Bizim fiyat:{' '}
                    <span className="font-medium text-foreground">
                      {formatTryFromDecimal(buyBox.ourPrice)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(buyBox.capturedAt)}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  BuyBox verisi yok
                </p>
              )}
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Son senkron</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {(active ?? listing).lastSyncAt
                  ? formatDistanceToNow(
                      new Date((active ?? listing).lastSyncAt as string),
                      {
                        addSuffix: true,
                        locale: tr,
                      },
                    )
                  : 'Henüz senkron yok'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate((active ?? listing).lastSyncAt)}
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="mb-2 text-sm font-medium">Fiyat geçmişi</p>
              {detailQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Kayıtlı fiyat geçmişi yok
                </p>
              ) : (
                <div className="h-48 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => `${String(v)} ₺`}
                      />
                      <Tooltip
                        formatter={(value: unknown) => {
                          const n =
                            typeof value === 'number'
                              ? value
                              : Number(value);
                          if (!Number.isFinite(n)) {
                            return ['—', 'Satış'];
                          }
                          return [formatTryFromDecimal(String(n)), 'Satış'];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="fiyat"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Stok güncelle</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sheet-stock">Adet</Label>
                  <Input
                    id="sheet-stock"
                    inputMode="numeric"
                    className="w-28"
                    value={stockQty}
                    onChange={(e) => {
                      setStockQty(e.target.value);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={updateStockMutation.isPending || !active}
                  onClick={() => {
                    if (!active) {
                      return;
                    }
                    const q = Number(stockQty);
                    if (!Number.isFinite(q) || q < 0) {
                      return;
                    }
                    updateStockMutation.mutate({ id: active.id, quantity: q });
                  }}
                >
                  Uygula
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Fiyat güncelle</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sheet-sale">Satış</Label>
                  <Input
                    id="sheet-sale"
                    inputMode="decimal"
                    value={salePrice}
                    onChange={(e) => {
                      setSalePrice(e.target.value);
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sheet-list">Liste</Label>
                  <Input
                    id="sheet-list"
                    inputMode="decimal"
                    value={listPrice}
                    onChange={(e) => {
                      setListPrice(e.target.value);
                    }}
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={updatePriceMutation.isPending || !active}
                onClick={() => {
                  if (!active) {
                    return;
                  }
                  const s = Number(salePrice);
                  const l = Number(listPrice);
                  if (
                    !Number.isFinite(s) ||
                    !Number.isFinite(l) ||
                    s <= 0 ||
                    l <= 0
                  ) {
                    return;
                  }
                  updatePriceMutation.mutate({
                    id: active.id,
                    salePrice: s,
                    listPrice: l,
                  });
                }}
              >
                Fiyatı uygula
              </Button>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Görseller</p>
              {(active ?? listing).imageUrls.length === 0 ? (
                <p className="text-sm text-muted-foreground">Görsel yok</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {(active ?? listing).imageUrls.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="aspect-square rounded-md border object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
