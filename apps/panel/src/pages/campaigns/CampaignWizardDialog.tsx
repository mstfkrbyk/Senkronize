import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { api } from '@/lib/api';
import type {
  CampaignImpact,
  CampaignTargetMode,
  CampaignType,
  CreateCampaignInput,
} from '@/types/campaign';
import type { ProductListItem } from '@/types/product';

import {
  CAMPAIGN_TYPE_LABELS,
  DISCOUNT_TYPE_LABELS,
  formatMoney,
  PLATFORM_OPTIONS,
} from './campaign-labels';
import { useAnalyzeCampaign, useCreateCampaign } from './hooks/useCampaigns';

interface CategoryTreeNode {
  id: string;
  name: string;
  children?: CategoryTreeNode[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM = {
  name: '',
  type: 'FLASH_SALE' as CampaignType,
  startDate: '',
  endDate: '',
  platforms: [] as string[],
  targetMode: 'ALL' as CampaignTargetMode,
  productIds: [] as string[],
  categoryIds: [] as string[],
  discountType: 'PERCENTAGE' as CreateCampaignInput['discountType'],
  discountValue: '',
  minPrice: '',
  couponCode: '',
  minOrderAmount: '',
  maxUses: '',
  stackable: false,
};

function flattenCategories(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) {
      result.push(...flattenCategories(node.children));
    }
  }
  return result;
}

function toIsoDateTime(localValue: string): string {
  if (!localValue) {
    return '';
  }
  return new Date(localValue).toISOString();
}

export function CampaignWizardDialog({
  open,
  onOpenChange,
}: Props): ReactElement {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [impact, setImpact] = useState<CampaignImpact | null>(null);

  const analyzeMutation = useAnalyzeCampaign();
  const createMutation = useCreateCampaign();

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: async (): Promise<CategoryTreeNode[]> => {
      const { data } = await api.get<CategoryTreeNode[]>('/categories/tree');
      return data;
    },
    enabled: open && form.targetMode === 'CATEGORIES',
  });

  const productsQuery = useQuery({
    queryKey: ['products', 'campaign-picker'],
    queryFn: async (): Promise<ProductListItem[]> => {
      const { data } = await api.get<{ items: ProductListItem[] }>('/products', {
        params: { page: 1, limit: 100, isActive: true },
      });
      return data.items;
    },
    enabled: open && form.targetMode === 'PRODUCTS',
  });

  const flatCategories = useMemo(
    () => flattenCategories(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );

  useEffect(() => {
    if (!open) {
      setStep(1);
      setForm(EMPTY_FORM);
      setImpact(null);
    }
  }, [open]);

  const buildPayload = (): CreateCampaignInput | null => {
    if (!form.name.trim() || !form.startDate || form.platforms.length === 0) {
      return null;
    }
    const discountValue = Number.parseFloat(form.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return null;
    }

    return {
      name: form.name.trim(),
      type: form.type,
      startDate: toIsoDateTime(form.startDate),
      endDate: form.endDate ? toIsoDateTime(form.endDate) : undefined,
      platforms: form.platforms,
      productIds:
        form.targetMode === 'PRODUCTS' ? form.productIds : [],
      categoryIds:
        form.targetMode === 'CATEGORIES' ? form.categoryIds : [],
      discountType: form.discountType,
      discountValue,
      minPrice: form.minPrice
        ? Number.parseFloat(form.minPrice)
        : undefined,
      minOrderAmount: form.minOrderAmount
        ? Number.parseFloat(form.minOrderAmount)
        : undefined,
      maxUses: form.maxUses ? Number.parseInt(form.maxUses, 10) : undefined,
      couponCode: form.couponCode.trim() || undefined,
      stackable: form.stackable,
    };
  };

  const togglePlatform = (value: string): void => {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(value)
        ? prev.platforms.filter((p) => p !== value)
        : [...prev.platforms, value],
    }));
  };

  const toggleProduct = (id: string): void => {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(id)
        ? prev.productIds.filter((p) => p !== id)
        : [...prev.productIds, id],
    }));
  };

  const toggleCategory = (id: string): void => {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  };

  const handleAnalyze = async (): Promise<void> => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    const result = await analyzeMutation.mutateAsync(payload);
    setImpact(result);
  };

  const handleCreate = async (): Promise<void> => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    await createMutation.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Yeni kampanya — Adım {step}/3
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Kampanya adı</Label>
              <Input
                id="campaign-name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Örn. Yaz sezonu indirimi"
              />
            </div>

            <div className="space-y-2">
              <Label>Kampanya tipi</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, type: v as CampaignType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CAMPAIGN_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-date">Başlangıç</Label>
                <Input
                  id="start-date"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Bitiş (opsiyonel)</Label>
                <Input
                  id="end-date"
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Platformlar</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PLATFORM_OPTIONS.map((p) => (
                  <label
                    key={p.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <Checkbox
                      checked={form.platforms.includes(p.value)}
                      onCheckedChange={() => togglePlatform(p.value)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Hedef</Label>
              <Select
                value={form.targetMode}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    targetMode: v as CampaignTargetMode,
                    productIds: [],
                    categoryIds: [],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tüm ürünler</SelectItem>
                  <SelectItem value="CATEGORIES">Kategoriler</SelectItem>
                  <SelectItem value="PRODUCTS">Belirli ürünler</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.targetMode === 'CATEGORIES' ? (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                {categoriesQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Yükleniyor…</p>
                ) : flatCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Kategori bulunamadı.
                  </p>
                ) : (
                  flatCategories.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={form.categoryIds.includes(cat.id)}
                        onCheckedChange={() => toggleCategory(cat.id)}
                      />
                      {cat.name}
                    </label>
                  ))
                )}
              </div>
            ) : null}

            {form.targetMode === 'PRODUCTS' ? (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                {productsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Yükleniyor…</p>
                ) : (productsQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ürün bulunamadı.
                  </p>
                ) : (
                  (productsQuery.data ?? []).map((product) => (
                    <label
                      key={product.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={form.productIds.includes(product.id)}
                        onCheckedChange={() => toggleProduct(product.id)}
                      />
                      {product.name} ({product.barcode})
                    </label>
                  ))
                )}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>İndirim tipi</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      discountType: v as CreateCampaignInput['discountType'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DISCOUNT_TYPE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-value">İndirim değeri</Label>
                <Input
                  id="discount-value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discountValue}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      discountValue: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-price">Min fiyat koruması (₺)</Label>
              <Input
                id="min-price"
                type="number"
                min={0}
                step="0.01"
                value={form.minPrice}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, minPrice: e.target.value }))
                }
                placeholder="Opsiyonel"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coupon-code">Kupon kodu</Label>
                <Input
                  id="coupon-code"
                  value={form.couponCode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      couponCode: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Opsiyonel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-order">Min. sipariş tutarı (₺)</Label>
                <Input
                  id="min-order"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.minOrderAmount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      minOrderAmount: e.target.value,
                    }))
                  }
                  placeholder="Opsiyonel"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max-uses">Maks. kullanım</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min={1}
                  value={form.maxUses}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, maxUses: e.target.value }))
                  }
                  placeholder="Sınırsız"
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <Checkbox
                  checked={form.stackable}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      stackable: checked === true,
                    }))
                  }
                />
                Diğer kampanyalarla birleştirilebilir
              </label>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{form.name || '—'}</p>
              <p className="text-muted-foreground">
                {CAMPAIGN_TYPE_LABELS[form.type]} ·{' '}
                {form.platforms.length} platform ·{' '}
                {DISCOUNT_TYPE_LABELS[form.discountType]}: {form.discountValue}
              </p>
            </div>

            {!impact ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={analyzeMutation.isPending || !buildPayload()}
                onClick={() => void handleAnalyze()}
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Etki analizi çalıştır
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Etkilenecek ürün
                    </p>
                    <p className="text-lg font-semibold">
                      {impact.affectedProductCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Tahmini gelir kaybı
                    </p>
                    <p className="text-lg font-semibold text-amber-700">
                      {formatMoney(impact.estimatedRevenueLoss)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Ort. indirim
                    </p>
                    <p className="text-lg font-semibold">
                      %{impact.avgDiscountPct.toLocaleString('tr-TR')}
                    </p>
                  </div>
                </div>

                {impact.productsAtRisk.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                      Riskli ürünler ({impact.productsAtRisk.length})
                    </p>
                    <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
                      {impact.productsAtRisk.map((p) => (
                        <li key={p.id} className="flex justify-between gap-2">
                          <span className="truncate">{p.name}</span>
                          <Badge variant="destructive">
                            Marj: %{p.marginPct?.toLocaleString('tr-TR') ?? '—'}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Marj riski tespit edilmedi.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
            >
              Geri
            </Button>
          ) : null}
          {step < 3 ? (
            <Button
              type="button"
              disabled={
                step === 1 &&
                (!form.name.trim() ||
                  !form.startDate ||
                  form.platforms.length === 0)
              }
              onClick={() => setStep((s) => s + 1)}
            >
              İleri
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!impact || createMutation.isPending}
              onClick={() => void handleCreate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Kampanyayı oluştur
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
