import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbTail } from '@/hooks/useBreadcrumbTail';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  getListingPlatformUrl,
  LISTING_STATUS_CLASS,
  LISTING_STATUS_LABEL,
} from '@/lib/listing-display';
import { getApiErrorMessage } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';

import {
  useListingDetail,
  useSyncListing,
} from './hooks/useListings';

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
    return format(new Date(iso), 'd MMM yyyy HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

export function ListingDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const listingId = id ?? null;

  const detailQuery = useListingDetail(listingId, true);
  const syncMutation = useSyncListing();

  const listing = detailQuery.data?.listing;
  const title = listing?.title ?? 'Listeleme detayı';
  usePageTitle(title);
  useBreadcrumbTail(title);

  const chartData = useMemo(() => {
    const pts = detailQuery.data?.priceHistory ?? [];
    return [...pts]
      .reverse()
      .map((p) => ({
        label: format(new Date(p.appliedAt), 'd MMM', { locale: tr }),
        fiyat: Number(p.newPrice),
      }));
  }, [detailQuery.data?.priceHistory]);

  const platformUrl =
    listing != null
      ? getListingPlatformUrl(
          listing.platform,
          listing.platformProductId,
          listing.barcode,
        )
      : null;

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !listing) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/listings">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Listelemeler
          </Link>
        </Button>
        <p className="text-destructive">
          {detailQuery.error
            ? getApiErrorMessage(detailQuery.error)
            : 'Listeleme bulunamadı'}
        </p>
      </div>
    );
  }

  const branding = getMarketplaceBranding(listing.platform);
  const buyBox = detailQuery.data?.buyBox;
  const syncErrors = detailQuery.data?.syncErrors ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link to="/listings">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Listelemeler
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <span aria-hidden>{branding.logo}</span>
            <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
            <Badge
              variant="outline"
              className={LISTING_STATUS_CLASS[listing.status]}
            >
              {LISTING_STATUS_LABEL[listing.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {branding.label} · Barkod{' '}
            <span className="font-mono">{listing.barcode}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {platformUrl ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={platformUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                Platformda gör
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={syncMutation.isPending}
            onClick={() => {
              syncMutation.mutate(listing.id);
            }}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Şimdi sync et
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Ürün bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {listing.imageUrls[0] ? (
              <ProductImage
                src={listing.imageUrls[0]}
                alt={listing.title}
                fluid
                className="aspect-square w-full max-h-48 rounded-lg object-cover"
              />
            ) : null}
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Barkod</dt>
                <dd className="font-mono">{listing.barcode}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Kategori</dt>
                <dd>{detailQuery.data?.category?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Platform SKU</dt>
                <dd className="font-mono text-xs">{listing.platformProductId}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Platform fiyat ve stok</CardTitle>
            <CardDescription>
              Son senkron:{' '}
              {listing.lastSyncAt
                ? formatDistanceToNow(new Date(listing.lastSyncAt), {
                    addSuffix: true,
                    locale: tr,
                  })
                : 'Henüz yok'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Satış fiyatı</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatTryFromDecimal(listing.salePrice)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Liste fiyatı</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatTryFromDecimal(listing.listPrice)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Stok</p>
                <p className="text-xl font-semibold tabular-nums">{listing.quantity}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fiyat geçmişi</CardTitle>
            <CardDescription>Son 30 gün</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kayıtlı fiyat geçmişi yok</p>
            ) : (
              <div className="h-56 w-full min-w-0">
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
                          typeof value === 'number' ? value : Number(value);
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">BuyBox durumu</CardTitle>
          </CardHeader>
          <CardContent>
            {buyBox ? (
              <div className="space-y-2 text-sm">
                {buyBox.isWinner ? (
                  <Badge className="border-0 bg-emerald-600 text-white">
                    BuyBox kazanan
                  </Badge>
                ) : (
                  <Badge variant="secondary">BuyBox kaybeden</Badge>
                )}
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
              <p className="text-sm text-muted-foreground">BuyBox verisi yok</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Senkron hata logları</CardTitle>
          <CardDescription>Son 30 gün — bu ürünle ilişkili hatalar</CardDescription>
        </CardHeader>
        <CardContent>
          {syncErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıtlı hata yok</p>
          ) : (
            <ul className="space-y-3">
              {syncErrors.map((err) => (
                <li
                  key={err.id}
                  className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm"
                >
                  <p className="font-medium text-destructive">{err.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(err.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
