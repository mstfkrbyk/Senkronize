import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, RefreshCw, Search, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import { toast } from 'sonner';

interface UnmatchedRow {
  id: string;
  platform: string;
  barcode: string;
  title: string;
  salePrice: string;
  listPrice: string;
  quantity: number;
  productId: string | null;
  platformProductId: string;
}

interface ConflictRow {
  kind: string;
  listingId: string;
  platform: string;
  barcode: string;
  listingProductId: string | null;
  matchMasterProductId: string | null;
  title: string;
}

interface MatchSummary {
  listingsProcessed: number;
  listingsLinked: number;
  newProductsCreated: number;
  newMatchesCreated: number;
  alreadyInSync: number;
}

interface SimilarRow {
  id: string;
  name: string;
  barcode: string;
  sku: string | null;
  confidence: number;
}

interface ProductHit {
  id: string;
  barcode: string;
  name: string;
  sku: string | null;
}

type ProductMatchKey = 'BARCODE' | 'SKU' | 'MANUAL';

interface OrganizationSettings {
  productMatchKey: ProductMatchKey | null;
}


export function ProductMatchingPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.productMatching'));
  usePageTitle(t('nav.productMatching'));
  const qc = useQueryClient();
  const [manualListing, setManualListing] = useState<UnmatchedRow | null>(null);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [hitsLoading, setHitsLoading] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['organizations', 'settings'],
    queryFn: async (): Promise<OrganizationSettings> => {
      const { data } = await api.get<OrganizationSettings>('/organizations/settings');
      return data;
    },
  });

  const unmatchedQuery = useQuery({
    queryKey: ['product-matches', 'unmatched'] as const,
    queryFn: async () => {
      const { data } = await api.get<UnmatchedRow[]>('/product-matches/unmatched');
      return data;
    },
  });

  const conflictsQuery = useQuery({
    queryKey: ['product-matches', 'conflicts'] as const,
    queryFn: async () => {
      const { data } = await api.get<ConflictRow[]>('/product-matches/conflicts');
      return data;
    },
  });

  const similarQuery = useQuery({
    queryKey: ['product-matches', 'similar', manualListing?.id] as const,
    queryFn: async () => {
      if (!manualListing) {
        return [];
      }
      const { data } = await api.get<SimilarRow[]>(
        `/product-matches/similar/${manualListing.id}`,
      );
      return data;
    },
    enabled: Boolean(manualListing),
  });

  const autoMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<MatchSummary>('/product-matches/auto');
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `İşlendi: ${data.listingsProcessed} listeleme, ${data.newProductsCreated} yeni ürün, ${data.listingsLinked} bağlantı`,
      );
      void qc.invalidateQueries({ queryKey: ['product-matches'] });
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const manualMut = useMutation({
    mutationFn: async (payload: { listingId: string; masterProductId: string }) => {
      await api.post('/product-matches/manual', payload);
    },
    onSuccess: async () => {
      toast.success('Eşleştirme kaydedildi');
      setManualListing(null);
      await qc.invalidateQueries({ queryKey: ['product-matches'] });
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const searchProducts = useCallback(async (): Promise<void> => {
    const q = barcodeSearch.trim();
    if (q.length < 1) {
      toast.message('Barkod girin');
      return;
    }
    setHitsLoading(true);
    try {
      const { data } = await api.get<ProductHit[] | { items: ProductHit[]; total: number }>(
        '/products',
        {
          params: { search: q, limit: 30, page: 1 },
        },
      );
      setHits(Array.isArray(data) ? data : data.items);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e));
      setHits([]);
    } finally {
      setHitsLoading(false);
    }
  }, [barcodeSearch]);

  const unmatched = unmatchedQuery.data ?? [];
  const conflicts = conflictsQuery.data ?? [];

  const tabHint = useMemo(() => {
    const key = settingsQuery.data?.productMatchKey;
    if (!key) {
      return (
        <p className="text-muted-foreground text-sm">
          {t('productMatching.matchKey.hint.notConfigured')}
        </p>
      );
    }
    return (
      <p className="text-muted-foreground text-sm">
        {t(`productMatching.matchKey.hint.${key}`)}
      </p>
    );
  }, [settingsQuery.data?.productMatchKey, t]);

  const orgMatchKey = settingsQuery.data?.productMatchKey ?? null;
  const autoMatchDisabled =
    autoMut.isPending || orgMatchKey === null || orgMatchKey === 'MANUAL';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.productMatching')}
        description={t('productMatching.description')}
        context={navContextLine}
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => autoMut.mutate()}
            disabled={autoMatchDisabled}
          >
            {autoMut.isPending ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 size-4" />
            )}
            {t('productMatching.autoMatch')}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="size-4" />
            {t('productMatching.matchKey.title')}
          </CardTitle>
          <CardDescription>
            {orgMatchKey
              ? t(`productMatching.matchKey.hint.${orgMatchKey}`)
              : t('productMatching.matchKey.hint.notConfigured')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground text-sm">
            {t('productMatching.matchKey.hierarchy')}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings/product-matching">
              {t('settings.productMatching.openSettings')}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {tabHint}

      <Tabs defaultValue="unmatched" className="w-full">
        <TabsList>
          <TabsTrigger value="unmatched">
            Eşleşmeyen ({unmatchedQuery.isLoading ? '…' : unmatched.length})
          </TabsTrigger>
          <TabsTrigger value="conflicts">
            Çakışmalar ({conflictsQuery.isLoading ? '…' : conflicts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unmatched" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eşleşmeyen listelemeler</CardTitle>
              <CardDescription>
                Bir satıra tıklayarak manuel eşleştirme veya benzer ürün önerilerini açın
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unmatchedQuery.isLoading ? (
                <TableSkeleton rows={5} cols={5} />
              ) : unmatchedQuery.isError ? (
                <EmptyState
                  title="Yüklenemedi"
                  description={getApiErrorMessage(unmatchedQuery.error)}
                />
              ) : unmatched.length === 0 ? (
                <EmptyState title="Tüm listelemeler eşleşmiş görünüyor" description="Yeni listeleme geldiğinde burada görünür." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Barkod</TableHead>
                      <TableHead>Başlık</TableHead>
                      <TableHead className="text-right">Satış</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatched.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => setManualListing(r)}
                      >
                        <TableCell>{getMarketplaceBranding(r.platform).label}</TableCell>
                        <TableCell className="font-mono text-xs">{r.barcode}</TableCell>
                        <TableCell className="max-w-md truncate">{r.title}</TableCell>
                        <TableCell className="text-right text-sm">
                          {Number.parseFloat(r.salePrice).toLocaleString('tr-TR', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          ₺
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Çakışmalar</CardTitle>
              <CardDescription>
                Listelemedeki ürün ile eşleşme kaydı farklı ana ürün gösteriyorsa burada listelenir
              </CardDescription>
            </CardHeader>
            <CardContent>
              {conflictsQuery.isLoading ? (
                <TableSkeleton rows={4} cols={4} />
              ) : conflictsQuery.isError ? (
                <EmptyState
                  title="Yüklenemedi"
                  description={getApiErrorMessage(conflictsQuery.error)}
                />
              ) : conflicts.length === 0 ? (
                <EmptyState title="Çakışma yok" description="Liste ve eşleşme kayıtları uyumlu." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tür</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Barkod</TableHead>
                      <TableHead>İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflicts.map((c) => (
                      <TableRow key={`${c.kind}-${c.listingId}`}>
                        <TableCell className="text-xs">{c.kind}</TableCell>
                        <TableCell>{getMarketplaceBranding(c.platform).label}</TableCell>
                        <TableCell className="font-mono text-xs">{c.barcode}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const row: UnmatchedRow = {
                                id: c.listingId,
                                platform: c.platform,
                                barcode: c.barcode,
                                title: c.title,
                                salePrice: '0',
                                listPrice: '0',
                                quantity: 0,
                                productId: c.listingProductId,
                                platformProductId: '',
                              };
                              setManualListing(row);
                            }}
                          >
                            Çözümle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(manualListing)} onOpenChange={(o) => !o && setManualListing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manuel eşleştirme</DialogTitle>
          </DialogHeader>
          {manualListing ? (
            <div className="space-y-4 py-2">
              <p className="text-muted-foreground text-sm">
                <span className="font-medium text-foreground">{manualListing.title}</span>
                <br />
                Barkod:{' '}
                <span className="font-mono">{manualListing.barcode}</span> ·{' '}
                {getMarketplaceBranding(manualListing.platform).label}
              </p>

              <div className="space-y-2">
                <Label>Benzer katalog ürünleri</Label>
                {similarQuery.isLoading ? (
                  <TableSkeleton rows={3} cols={3} />
                ) : (similarQuery.data ?? []).length === 0 ? (
                  <p className="text-muted-foreground text-sm">Öneri bulunamadı.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ürün</TableHead>
                        <TableHead className="w-20 text-right">Güven</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(similarQuery.data ?? []).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="text-sm font-medium">{s.name}</div>
                            <div className="text-muted-foreground font-mono text-xs">
                              {s.barcode}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {(s.confidence * 100).toFixed(0)}%
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                manualMut.mutate({
                                  listingId: manualListing.id,
                                  masterProductId: s.id,
                                })
                              }
                            >
                              Seç
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label>Barkod ile ürün ara</Label>
                <div className="flex gap-2">
                  <Input
                    value={barcodeSearch}
                    onChange={(e) => setBarcodeSearch(e.target.value)}
                    placeholder="Barkod veya ad"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void searchProducts()}
                    disabled={hitsLoading}
                  >
                    <Search className="size-4" />
                  </Button>
                </div>
                {hits.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ürün</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hits.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>
                            <div className="text-sm font-medium">{h.name}</div>
                            <div className="text-muted-foreground font-mono text-xs">
                              {h.barcode}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                manualMut.mutate({
                                  listingId: manualListing.id,
                                  masterProductId: h.id,
                                })
                              }
                            >
                              Seç
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManualListing(null)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
