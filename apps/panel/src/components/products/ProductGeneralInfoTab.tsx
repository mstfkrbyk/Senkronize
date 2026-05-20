import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, getApiErrorMessage } from '@/lib/api';
import type { ProductDetailPayload } from '@/types/product';

const WEIGHT_TAG_PREFIX = 'agirlik:';

interface Props {
  product: ProductDetailPayload['product'];
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  category: string;
  brand: string;
  barcode: string;
  weight: string;
  isActive: boolean;
}

function extractWeight(tags: string[]): string {
  const tag = tags.find((t) => t.startsWith(WEIGHT_TAG_PREFIX));
  return tag ? tag.slice(WEIGHT_TAG_PREFIX.length) : '';
}

function buildTagsWithWeight(tags: string[], weight: string): string[] {
  const filtered = tags.filter((t) => !t.startsWith(WEIGHT_TAG_PREFIX));
  const trimmed = weight.trim();
  if (trimmed) {
    filtered.push(`${WEIGHT_TAG_PREFIX}${trimmed}`);
  }
  return filtered;
}

function toFormState(product: ProductDetailPayload['product']): FormState {
  return {
    name: product.name,
    description: product.description ?? '',
    category: product.category ?? '',
    brand: product.brand ?? '',
    barcode: product.barcode,
    weight: extractWeight(product.tags ?? []),
    isActive: product.isActive,
  };
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), 'd MMM yyyy HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

export function ProductGeneralInfoTab({ product, onSaved }: Props): ReactElement {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(product));

  useEffect(() => {
    if (!editing) {
      setForm(toFormState(product));
    }
  }, [product, editing]);

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      await api.patch(`/products/${product.id}`, {
        name: payload.name.trim(),
        description: payload.description.trim() || null,
        category: payload.category.trim() || null,
        brand: payload.brand.trim() || null,
        barcode: payload.barcode.trim(),
        isActive: payload.isActive,
        tags: buildTagsWithWeight(product.tags ?? [], payload.weight),
      });
    },
    onSuccess: () => {
      toast.success('Ürün bilgileri kaydedildi');
      setEditing(false);
      onSaved();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const cancelEdit = (): void => {
    setForm(toFormState(product));
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Genel bilgiler</CardTitle>
          <CardDescription>
            Son güncelleme: {formatDate(product.updatedAt)}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!editing ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(true);
              }}
            >
              <Pencil className="mr-2 size-4" />
              Düzenle
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={cancelEdit}
              >
                <X className="mr-2 size-4" />
                İptal
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!form.name.trim() || !form.barcode.trim() || saveMutation.isPending}
                onClick={() => {
                  saveMutation.mutate(form);
                }}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Kaydet
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Yayın durumu</p>
            <p className="text-muted-foreground text-xs">
              {form.isActive ? 'Yayında — katalogda görünür' : 'Taslak — pasif'}
            </p>
          </div>
          <Switch
            checked={form.isActive}
            disabled={!editing}
            onCheckedChange={(checked) => {
              setForm((f) => ({ ...f, isActive: checked }));
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="product-name">Ürün adı</Label>
            <Input
              id="product-name"
              value={form.name}
              disabled={!editing}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
              }}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="product-desc">Açıklama</Label>
            <Textarea
              id="product-desc"
              value={form.description}
              disabled={!editing}
              rows={4}
              onChange={(e) => {
                setForm((f) => ({ ...f, description: e.target.value }));
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="product-category">Kategori</Label>
            <Input
              id="product-category"
              value={form.category}
              disabled={!editing}
              onChange={(e) => {
                setForm((f) => ({ ...f, category: e.target.value }));
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="product-brand">Marka</Label>
            <Input
              id="product-brand"
              value={form.brand}
              disabled={!editing}
              onChange={(e) => {
                setForm((f) => ({ ...f, brand: e.target.value }));
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="product-barcode">Barkod</Label>
            <Input
              id="product-barcode"
              className="font-mono"
              value={form.barcode}
              disabled={!editing}
              onChange={(e) => {
                setForm((f) => ({ ...f, barcode: e.target.value }));
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="product-weight">Ağırlık</Label>
            <Input
              id="product-weight"
              placeholder="ör. 0,5 kg"
              value={form.weight}
              disabled={!editing}
              onChange={(e) => {
                setForm((f) => ({ ...f, weight: e.target.value }));
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>SKU</Label>
            <Input value={product.sku ?? '—'} disabled className="font-mono" />
          </div>
          <div className="grid gap-2">
            <Label>Oluşturulma</Label>
            <Input value={formatDate(product.createdAt)} disabled />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
