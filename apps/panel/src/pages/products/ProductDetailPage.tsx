import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  Copy,
  Loader2,
  Percent,
  Trash2,
  Upload,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, getApiErrorMessage } from '@/lib/api';
import { useBreadcrumbTail } from '@/hooks/useBreadcrumbTail';
import { usePageTitle } from '@/hooks/usePageTitle';
import { recordRecentView } from '@/lib/recent-views';
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import { ProductImagesTab } from '@/pages/products/components/ProductImagesTab';
import { ProductPerformanceTab } from '@/pages/products/components/ProductPerformanceTab';
import type {
  BulkPriceUpdateForm,
  ImportResult,
  ProductDetailPayload,
  ProductVariantDto,
} from '@/types/product';

function marketplaceLabel(code: string): string {
  const found = MARKETPLACE_OPTIONS.find((o) => o.id === code);
  return found?.label ?? code;
}

function parseAttributes(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') {
      out[k] = v;
    }
  }
  return out;
}

function formatMoney(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  const n = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), 'd MMM yyyy HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

function VariantInlineCell({
  productId,
  variant,
  field,
  onSaved,
}: {
  productId: string;
  variant: ProductVariantDto;
  field: 'stock' | 'price';
  onSaved: () => void;
}): ReactElement {
  const initial =
    field === 'stock'
      ? String(variant.stock)
      : variant.price === null || variant.price === undefined
        ? ''
        : String(variant.price);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await api.patch(`/products/${productId}/variants/${variant.id}`, body);
    },
    onSuccess: () => {
      onSaved();
      setEditing(false);
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const persist = (): void => {
    if (field === 'stock') {
      const n = Number.parseInt(value, 10);
      patchMutation.mutate({
        stock: Number.isFinite(n) ? n : variant.stock,
      });
      return;
    }
    const trim = value.trim();
    const n = trim === '' ? null : Number.parseFloat(trim.replace(',', '.'));
    patchMutation.mutate({
      price: trim === '' ? null : Number.isFinite(n) ? n : undefined,
    });
  };

  if (!editing) {
    return (
      <TableCell
        className="cursor-pointer tabular-nums"
        onClick={() => { setEditing(true); }}
      >
        {field === 'stock'
          ? variant.stock.toLocaleString('tr-TR')
          : formatMoney(variant.price)}
      </TableCell>
    );
  }

  return (
    <TableCell>
      <Input
        className="h-8"
        autoFocus
        inputMode={field === 'stock' ? 'numeric' : 'decimal'}
        value={value}
        onChange={(e) => { setValue(e.target.value); }}
        onBlur={() => { persist(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            persist();
          }
          if (e.key === 'Escape') {
            setValue(initial);
            setEditing(false);
          }
        }}
      />
    </TableCell>
  );
}

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

function BulkVariantPriceDialog({
  productId,
  onDone,
}: {
  productId: string;
  onDone: () => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BulkPriceUpdateForm>({
    updateType: 'percentage',
    value: 10,
    direction: 'increase',
    applyToField: 'salePrice',
    previewCount: 0,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch<{ updated: number }>(
        `/products/${productId}/variants/bulk-price`,
        {
          updateType: form.updateType,
          value: form.value,
          direction: form.direction,
        },
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} varyant fiyatı güncellendi`);
      setOpen(false);
      onDone();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Percent className="mr-2 size-4" />
          Toplu fiyat
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Toplu varyant fiyat güncelleme</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Select
            value={form.updateType}
            onValueChange={(v) => {
              setForm((f) => ({
                ...f,
                updateType: v as BulkPriceUpdateForm['updateType'],
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Yüzde</SelectItem>
              <SelectItem value="fixed">Sabit</SelectItem>
              <SelectItem value="set">Belirle</SelectItem>
            </SelectContent>
          </Select>
          <Input
            inputMode="decimal"
            value={String(form.value)}
            onChange={(e) => {
              const n = Number.parseFloat(e.target.value.replace(',', '.'));
              setForm((f) => ({ ...f, value: Number.isFinite(n) ? n : 0 }));
            }}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => { mutation.mutate(); }}
          >
            Uygula
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
            <Input
              id="v-renk"
              value={renk}
              onChange={(e) => { setRenk(e.target.value); }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="v-beden">Beden</Label>
            <Input
              id="v-beden"
              value={beden}
              onChange={(e) => { setBeden(e.target.value); }}
            />
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
  const queryClient = useQueryClient();
  const variantCsvRef = useRef<HTMLInputElement>(null);

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
  usePageTitle(productName ?? 'Ürün detayı');
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
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Yükleniyor…
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <p className="text-destructive text-sm">
        {detailQuery.isError ? getApiErrorMessage(detailQuery.error) : 'Veri yok'}
      </p>
    );
  }

  const { product, variants, listings, stockMovements } = detailQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link to="/products">
              <ArrowLeft className="mr-2 size-4" />
              Kataloga dön
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground text-sm">
            SKU: {product.sku ?? '—'} · Barkod:{' '}
            <span className="font-mono">{product.barcode}</span>
            {product.brand ? ` · ${product.brand}` : ''}
            {product.category ? ` · ${product.category}` : ''}
          </p>
        </div>
      </div>

      <Tabs defaultValue="variants">
        <TabsList>
          <TabsTrigger value="variants">Varyantlar</TabsTrigger>
          <TabsTrigger value="images">Görseller</TabsTrigger>
          <TabsTrigger value="performance">Performans</TabsTrigger>
          <TabsTrigger value="listings">Listingler</TabsTrigger>
          <TabsTrigger value="stock">Stok hareketi</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">Varyantlar</CardTitle>
                <CardDescription>Stok ve fiyatları satır içi düzenleyebilirsiniz</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <AddVariantDialog productId={productId} onCreated={invalidate} />
                <BulkVariantPriceDialog productId={productId} onDone={invalidate} />
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
            <CardContent>
              {variants.length === 0 ? (
                <p className="text-muted-foreground text-sm">Henüz varyant yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Renk</TableHead>
                      <TableHead>Beden</TableHead>
                      <TableHead>Barkod</TableHead>
                      <TableHead>Stok</TableHead>
                      <TableHead>Satış fiyatı</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="w-[88px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((v) => {
                      const attrs = parseAttributes(v.attributes);
                      return (
                      <TableRow key={v.id}>
                        <TableCell>{attrs.Renk ?? '—'}</TableCell>
                        <TableCell>{attrs.Beden ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {v.barcode ?? '—'}
                        </TableCell>
                        <VariantInlineCell
                          productId={productId}
                          variant={v}
                          field="stock"
                          onSaved={invalidate}
                        />
                        <VariantInlineCell
                          productId={productId}
                          variant={v}
                          field="price"
                          onSaved={invalidate}
                        />
                        <TableCell>
                          <Switch
                            checked={v.isActive}
                            onCheckedChange={(checked) => {
                              void api
                                .patch(`/products/${productId}/variants/${v.id}`, {
                                  isActive: checked,
                                })
                                .then(() => {
                                  toast.success('Durum güncellendi');
                                  invalidate();
                                })
                                .catch((e: unknown) => {
                                  toast.error(getApiErrorMessage(e));
                                });
                            }}
                          />
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="mt-4">
          <ProductImagesTab
            productId={productId}
            imageUrls={product.imageUrls ?? []}
            onChanged={invalidate}
          />
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <ProductPerformanceTab productId={productId} />
        </TabsContent>

        <TabsContent value="listings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Listingler</CardTitle>
              <CardDescription>Pazaryeri listeleri</CardDescription>
            </CardHeader>
            <CardContent>
              {listings.length === 0 ? (
                <p className="text-muted-foreground text-sm">Henüz listing yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Başlık</TableHead>
                      <TableHead className="text-right">Satış</TableHead>
                      <TableHead className="text-right">Liste</TableHead>
                      <TableHead className="text-right">Adet</TableHead>
                      <TableHead>Onay</TableHead>
                      <TableHead>Son sync</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listings.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{marketplaceLabel(row.platform)}</TableCell>
                        <TableCell className="max-w-[240px]">
                          <div className="truncate font-medium">{row.title}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.salePrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.listPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.quantity.toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell>{row.approved ? 'Evet' : 'Hayır'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.lastSyncAt ? formatDate(row.lastSyncAt) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stok hareketi</CardTitle>
              <CardDescription>Stok kayıtları</CardDescription>
            </CardHeader>
            <CardContent>
              {stockMovements.length === 0 ? (
                <p className="text-muted-foreground text-sm">Stok kaydı yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barkod</TableHead>
                      <TableHead>Depo</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Miktar</TableHead>
                      <TableHead className="text-right">Rezerve</TableHead>
                      <TableHead>Güncellendi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockMovements.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">{row.barcode}</TableCell>
                        <TableCell className="text-sm">
                          {row.warehouseName} ({row.warehouseCode})
                        </TableCell>
                        <TableCell>
                          {row.platform ? marketplaceLabel(row.platform) : 'Merkezi'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.quantity.toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.reservedQty.toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(row.updatedAt)}
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
    </div>
  );
}

export function ProductDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <p className="text-muted-foreground text-sm">Ürün bulunamadı.</p>;
  }

  return <ProductDetailInner productId={id} />;
}
