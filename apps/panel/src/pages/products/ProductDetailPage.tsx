import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Copy,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { ImageManager } from '@/components/products/ImageManager';
import { ProductStockHistoryTab } from '@/components/products/ProductStockHistoryTab';
import { ProductGeneralInfoTab } from '@/components/products/ProductGeneralInfoTab';
import { ProductMatchKeyCard } from '@/components/products/ProductMatchKeyCard';
import { ProductListingsTab } from '@/components/products/ProductListingsTab';
import { ProductPerformanceTab } from '@/components/products/ProductPerformanceTab';
import { VariantMatrix } from '@/components/products/VariantMatrix';
import { parseAttributes } from '@/components/products/variant-utils';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, getApiErrorMessage } from '@/lib/api';
import { useActiveNav } from '@/hooks/useActiveNav';
import { useBreadcrumbTail } from '@/hooks/useBreadcrumbTail';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { recordRecentView } from '@/lib/recent-views';
import { CreateVariantsWizard } from '@/pages/products/components/CreateVariantsWizard';
import { VariantBulkActions } from '@/pages/products/components/VariantBulkActions';
import type {
  ImportResult,
  ProductDetailPayload,
  ProductVariantDto,
} from '@/types/product';

function CopyVariantDialog({
  productId,
  source,
  onCreated,
}: {
  productId: string;
  source: ProductVariantDto;
  onCreated: () => void;
}): ReactElement {
  const attrs = parseAttributes(source.attributes);
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState(`${source.sku}-KOPYA`);
  const [renk, setRenk] = useState(attrs.Renk ?? '');
  const [beden, setBeden] = useState(attrs.Beden ?? '');

  const mutation = useMutation({
    mutationFn: async () => {
      const nextAttrs: Record<string, string> = { ...attrs };
      if (renk.trim()) {
        nextAttrs.Renk = renk.trim();
      }
      if (beden.trim()) {
        nextAttrs.Beden = beden.trim();
      }
      const priceNum =
        source.price === null || source.price === undefined
          ? undefined
          : Number(source.price);
      await api.post(`/products/${productId}/variants`, {
        sku: sku.trim(),
        barcode: source.barcode,
        title: [renk.trim(), beden.trim()].filter(Boolean).join(' / ') || source.title,
        attributes: nextAttrs,
        stock: source.stock,
        ...(Number.isFinite(priceNum) ? { price: priceNum } : {}),
        imageUrl: source.imageUrl,
        isActive: source.isActive,
      });
    },
    onSuccess: () => {
      toast.success('Varyant kopyalandı');
      setOpen(false);
      onCreated();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" title="Varyanttan kopyala">
          <Copy className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Varyanttan kopyala</DialogTitle>
          <DialogDescription>
            Renk ve bedeni değiştirin; diğer bilgiler kaynak varyanttan alınır.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <Label htmlFor="copy-sku">SKU</Label>
            <Input id="copy-sku" value={sku} onChange={(e) => { setSku(e.target.value); }} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="copy-renk">Renk</Label>
            <Input id="copy-renk" value={renk} onChange={(e) => { setRenk(e.target.value); }} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="copy-beden">Beden</Label>
            <Input id="copy-beden" value={beden} onChange={(e) => { setBeden(e.target.value); }} />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={!sku.trim() || mutation.isPending}
            onClick={() => { mutation.mutate(); }}
          >
            Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddVariantDialog({
  productId,
  onCreated,
}: {
  productId: string;
  onCreated: () => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [renk, setRenk] = useState('');
  const [beden, setBeden] = useState('');
  const [stock, setStock] = useState('0');
  const [price, setPrice] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const attrs: Record<string, string> = {};
      if (renk.trim()) {
        attrs.Renk = renk.trim();
      }
      if (beden.trim()) {
        attrs.Beden = beden.trim();
      }
      const title =
        [renk.trim(), beden.trim()].filter(Boolean).join(' / ') || sku.trim();
      const priceNum =
        price.trim() === '' ? undefined : Number.parseFloat(price.replace(',', '.'));
      await api.post(`/products/${productId}/variants`, {
        sku: sku.trim(),
        title,
        attributes: attrs,
        stock: Number.parseInt(stock, 10) || 0,
        ...(Number.isFinite(priceNum) ? { price: priceNum } : {}),
      });
    },
    onSuccess: () => {
      toast.success('Varyant eklendi');
      setOpen(false);
      setSku('');
      setRenk('');
      setBeden('');
      setStock('0');
      setPrice('');
      onCreated();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          Varyant ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni varyant</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <Label htmlFor="v-sku">SKU</Label>
            <Input
              id="v-sku"
              value={sku}
              onChange={(e) => { setSku(e.target.value); }}
              placeholder="Benzersiz varyant SKU"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="v-renk">Renk</Label>
            <Input id="v-renk" value={renk} onChange={(e) => { setRenk(e.target.value); }} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="v-beden">Beden</Label>
            <Input id="v-beden" value={beden} onChange={(e) => { setBeden(e.target.value); }} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="v-stok">Stok</Label>
            <Input
              id="v-stok"
              inputMode="numeric"
              value={stock}
              onChange={(e) => { setStock(e.target.value); }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="v-fiyat">Fiyat (TRY)</Label>
            <Input
              id="v-fiyat"
              inputMode="decimal"
              value={price}
              onChange={(e) => { setPrice(e.target.value); }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={!sku.trim() || mutation.isPending}
            onClick={() => {
              mutation.mutate();
            }}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              'Kaydet'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductDetailInner({ productId }: { productId: string }): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.products'));
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') ?? 'general';
  const queryClient = useQueryClient();
  const variantCsvRef = useRef<HTMLInputElement>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);

  const detailQuery = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: async () => {
      const { data } = await api.get<ProductDetailPayload>(
        `/products/${productId}/detail`,
      );
      return data;
    },
  });

  const productName = detailQuery.data?.product.name;
  usePageTitle(productName ?? t('products.detailTitle'));
  useBreadcrumbTail(productName);

  useEffect(() => {
    const product = detailQuery.data?.product;
    if (!product) {
      return;
    }
    recordRecentView({
      type: 'product',
      id: productId,
      label: product.name,
      href: `/products/${productId}`,
    });
  }, [detailQuery.data?.product, productId]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['product-detail', productId] });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
    setSelectedVariantIds([]);
  }, [queryClient, productId]);

  const importVariantsMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post<ImportResult>(
        `/products/${productId}/variants/import`,
        body,
      );
      return data;
    },
    onSuccess: (res) => {
      toast.success(
        `Varyant içe aktarma: ${res.created} yeni, ${res.updated} güncellendi, ${res.errors.length} hata`,
      );
      invalidate();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (variantId: string) => {
      await api.delete(`/products/${productId}/variants/${variantId}`);
    },
    onSuccess: () => {
      toast.success('Varyant silindi');
      invalidate();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full max-w-xl" />
            <Skeleton className="h-96 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Card>
        <CardContent className="pt-6">
          {detailQuery.isError ? (
            <QueryErrorAlert
              error={detailQuery.error}
              onRetry={() => {
                void detailQuery.refetch();
              }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">{t('common.noData')}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const { product, variants, listings } = detailQuery.data;

  const productMeta = `SKU: ${product.sku ?? '—'} · Barkod: ${product.barcode}${product.brand ? ` · ${product.brand}` : ''}${product.category ? ` · ${product.category}` : ''}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={productMeta}
        context={navContextLine}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/products">
              <ArrowLeft className="mr-2 size-4" />
              {t('products.backToCatalog')}
            </Link>
          </Button>
        }
      />
      {!product.isActive ? (
        <p className="text-sm text-muted-foreground -mt-4">{t('products.draft')}</p>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="general">{t('products.tabs.general')}</TabsTrigger>
          <TabsTrigger value="variants">{t('products.tabs.variants')}</TabsTrigger>
          <TabsTrigger value="listings">{t('products.tabs.listings')}</TabsTrigger>
          <TabsTrigger value="images">{t('products.tabs.images')}</TabsTrigger>
          <TabsTrigger value="performance">{t('products.tabs.performance')}</TabsTrigger>
          <TabsTrigger value="stock">{t('products.tabs.stockHistory')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <ProductGeneralInfoTab product={product} onSaved={invalidate} />
          <ProductMatchKeyCard productId={product.id} value={product.productMatchKey} />
        </TabsContent>

        <TabsContent value="variants" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">Varyantlar</CardTitle>
                <CardDescription>
                  Matris veya liste görünümü; toplu işlemler için satırları seçin
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <CreateVariantsWizard
                  productId={productId}
                  productSku={product.sku}
                  productBarcode={product.barcode}
                  onCreated={invalidate}
                />
                <AddVariantDialog productId={productId} onCreated={invalidate} />
                <input
                  ref={variantCsvRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      importVariantsMutation.mutate(f);
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => variantCsvRef.current?.click()}
                >
                  <Upload className="mr-2 size-4" />
                  CSV içe aktar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <VariantBulkActions
                productId={productId}
                selectedIds={selectedVariantIds}
                onClearSelection={() => {
                  setSelectedVariantIds([]);
                }}
                onDone={invalidate}
              />
              {variants.length === 0 ? (
                <p className="text-muted-foreground text-sm">Henüz varyant yok.</p>
              ) : (
                <VariantMatrix
                  productId={productId}
                  variants={variants}
                  selectedIds={selectedVariantIds}
                  onSelectionChange={setSelectedVariantIds}
                  onRefresh={invalidate}
                  renderActions={(v) => (
                    <div className="flex items-center gap-0">
                      <CopyVariantDialog
                        productId={productId}
                        source={v}
                        onCreated={invalidate}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          if (
                            window.confirm(
                              'Bu varyantı silmek istediğinize emin misiniz?',
                            )
                          ) {
                            deleteVariantMutation.mutate(v.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listings" className="mt-4">
          <ProductListingsTab
            productId={productId}
            listings={listings}
            onChanged={invalidate}
          />
        </TabsContent>

        <TabsContent value="images" className="mt-4">
          <ImageManager
            productId={productId}
            imageUrls={product.imageUrls ?? []}
            onChanged={invalidate}
          />
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <ProductPerformanceTab
            productId={productId}
            productBarcode={product.barcode}
            variants={variants}
            listings={listings}
          />
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <ProductStockHistoryTab barcode={product.barcode} />
        </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProductDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">Ürün bulunamadı.</p>
        </CardContent>
      </Card>
    );
  }

  return <ProductDetailInner productId={id} />;
}
