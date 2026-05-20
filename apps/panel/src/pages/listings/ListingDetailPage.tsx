import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBreadcrumbTail } from '@/hooks/useBreadcrumbTail';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  getListingPlatformUrl,
  LISTING_STATUS_CLASS,
  LISTING_STATUS_LABEL,
} from '@/lib/listing-display';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import {
  useBuyBoxListingAnalysis,
  useCompetitorPrices,
} from '@/pages/pricing/hooks/usePricing';
import { formatTry } from '@/pages/pricing/pricing-utils';
import type { SyncLogEntry, SyncLogStatus } from '@/types/sync-log';

import {
  useListingDetail,
  useSyncListing,
  useUpdatePrice,
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

function syncStatusBadge(status: SyncLogStatus): ReactElement {
  const map: Record<
    SyncLogStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    RUNNING: { label: 'Çalışıyor', variant: 'secondary' },
    SUCCESS: { label: 'Başarılı', variant: 'default' },
    PARTIAL: { label: 'Kısmi', variant: 'outline' },
    FAILED: { label: 'Başarısız', variant: 'destructive' },
  };
  const c = map[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function ListingDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const listingId = id ?? null;

  const detailQuery = useListingDetail(listingId, true);
  const syncMutation = useSyncListing();
  const updatePriceMutation = useUpdatePrice();

  const listing = detailQuery.data?.listing;
  const title = listing?.title ?? 'Listeleme detayı';
  usePageTitle(title);
  useBreadcrumbTail(title);

  const buyBoxAnalysisQuery = useBuyBoxListingAnalysis(listingId, listing != null);
  const competitorQuery = useCompetitorPrices(
    listing?.barcode ?? null,
    listing != null,
  );

  const syncHistoryQuery = useQuery({
    queryKey: ['sync-logs', 'listing', listing?.platform, listing?.barcode],
    queryFn: async (): Promise<SyncLogEntry[]> => {
      const params = new URLSearchParams({
        platform: listing!.platform,
        limit: '10',
        jobTypeStartsWith: 'listings',
      });
      const { data } = await api.get<{ data: SyncLogEntry[] }>(
        `/sync/logs?${params.toString()}`,
      );
      return data.data;
    },
    enabled: listing != null,
    staleTime: 30_000,
  });

  const [salePriceInput, setSalePriceInput] = useState('');
  const [listPriceInput, setListPriceInput] = useState('');

  useEffect(() => {
    if (listing) {
      setSalePriceInput(String(Number(listing.salePrice)));
      setListPriceInput(String(Number(listing.listPrice)));
    }
  }, [listing]);

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

  const handlePriceSave = (): void => {
    if (!listing) {
      return;
    }
    const salePrice = Number(String(salePriceInput).replace(',', '.'));
    const listPrice = Number(String(listPriceInput).replace(',', '.'));
    if (
      !Number.isFinite(salePrice) ||
      salePrice <= 0 ||
      !Number.isFinite(listPrice) ||
      listPrice <= 0
    ) {
      toast.error('Geçerli fiyat değerleri girin');
      return;
    }
    if (listPrice < salePrice) {
      toast.error('Liste fiyatı satış fiyatından düşük olamaz');
      return;
    }
    updatePriceMutation.mutate({
      id: listing.id,
      salePrice,
      listPrice,
    });
  };

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
  const buyBoxAnalysis = buyBoxAnalysisQuery.data;
  const competitors = competitorQuery.data ?? [];
  const syncHistory = syncHistoryQuery.data ?? [];

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
            {branding.label} · SKU{' '}
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
            Zorla Sync Et
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Listing bilgileri</CardTitle>
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
                <dt className="text-muted-foreground">Platform</dt>
                <dd>{branding.label}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ürün / SKU</dt>
                <dd className="font-mono">{listing.barcode}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Kategori</dt>
                <dd>{detailQuery.data?.category?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Platform ürün ID</dt>
                <dd className="font-mono text-xs">{listing.platformProductId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Stok</dt>
                <dd className="font-semibold tabular-nums">{listing.quantity}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Fiyat düzenleme</CardTitle>
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
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="detail-sale-price">Satış fiyatı (₺)</Label>
                <Input
                  id="detail-sale-price"
                  inputMode="decimal"
                  value={salePriceInput}
                  onChange={(e) => {
                    setSalePriceInput(e.target.value);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="detail-list-price">Liste fiyatı (₺)</Label>
                <Input
                  id="detail-list-price"
                  inputMode="decimal"
                  value={listPriceInput}
                  onChange={(e) => {
                    setListPriceInput(e.target.value);
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={updatePriceMutation.isPending}
                onClick={handlePriceSave}
              >
                {updatePriceMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Fiyatı kaydet
              </Button>
              <p className="text-sm text-muted-foreground">
                Mevcut: {formatTryFromDecimal(listing.salePrice)}
              </p>
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
            <CardDescription>Rekabet analizi özeti</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {buyBox || buyBoxAnalysis ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {(buyBox?.isWinner ?? buyBoxAnalysis?.hasBuyBox) ? (
                    <Badge className="gap-1 border-0 bg-emerald-600 text-white">
                      <Check className="h-3 w-3" aria-hidden />
                      Kazanıyor
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-amber-400 text-amber-800">
                      <X className="h-3 w-3" aria-hidden />
                      Kaybediyor
                    </Badge>
                  )}
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">BuyBox fiyatı</dt>
                    <dd className="font-medium tabular-nums">
                      {buyBox
                        ? formatTryFromDecimal(buyBox.buyBoxPrice)
                        : buyBoxAnalysis?.buyBoxPrice != null
                          ? formatTry(buyBoxAnalysis.buyBoxPrice)
                          : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Bizim fiyat</dt>
                    <dd className="font-medium tabular-nums">
                      {buyBox
                        ? formatTryFromDecimal(buyBox.ourPrice)
                        : formatTry(buyBoxAnalysis?.currentPrice ?? Number(listing.salePrice))}
                    </dd>
                  </div>
                  {buyBoxAnalysis ? (
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Öneri</dt>
                      <dd>{buyBoxAnalysis.recommendation}</dd>
                    </div>
                  ) : null}
                </dl>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">BuyBox verisi yok</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rekabet analizi</CardTitle>
          <CardDescription>Platform rakip fiyatları</CardDescription>
        </CardHeader>
        <CardContent>
          {competitorQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : competitors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Rakip fiyat verisi yok</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rakip</TableHead>
                  <TableHead className="text-right">Fiyat</TableHead>
                  <TableHead>Son güncelleme</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.competitorName?.trim() || row.competitorId}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTry(Number(row.price))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.capturedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync geçmişi</CardTitle>
          <CardDescription>Son 10 senkronizasyon</CardDescription>
        </CardHeader>
        <CardContent>
          {syncHistoryQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : syncHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sync kaydı yok</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlem</TableHead>
                  <TableHead className="text-right">İşlenen</TableHead>
                  <TableHead>Zaman</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncHistory.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{syncStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-muted-foreground">{log.jobType}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {log.itemsProcessed}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(log.completedAt ?? log.startedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
