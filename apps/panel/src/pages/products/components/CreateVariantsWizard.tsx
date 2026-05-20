import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getApiErrorMessage } from '@/lib/api';
import type { ProductVariantDto } from '@/types/product';

import { cartesianProduct } from './variant-utils';

interface Props {
  productId: string;
  productSku: string | null;
  productBarcode: string;
  onCreated: () => void;
}

interface CustomAttribute {
  id: string;
  name: string;
  values: string[];
}

interface DraftVariant {
  key: string;
  color?: string;
  size?: string;
  customAttributes: Record<string, string>;
  included: boolean;
  stock: number;
  price: number | null;
  barcode: string;
}

function ChipInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}): ReactElement {
  const [input, setInput] = useState('');

  const addValue = (raw: string): void => {
    const trimmed = raw.trim();
    if (!trimmed || values.includes(trimmed)) {
      return;
    }
    onChange([...values, trimmed]);
    setInput('');
  };

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 pr-1">
            {v}
            <button
              type="button"
              className="rounded-full hover:bg-muted"
              aria-label={`${v} kaldır`}
              onClick={() => {
                onChange(values.filter((x) => x !== v));
              }}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          className="h-7 min-w-[120px] flex-1 border-0 shadow-none focus-visible:ring-0"
          value={input}
          placeholder={placeholder ?? 'Değer yazıp Enter'}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addValue(input);
            }
            if (e.key === 'Backspace' && input === '' && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (input.trim()) {
              addValue(input);
            }
          }}
        />
      </div>
    </div>
  );
}

function buildCombinationKey(parts: Record<string, string | undefined>): string {
  return Object.entries(parts)
    .filter(([, v]) => v)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
}

export function CreateVariantsWizard({
  productId,
  productSku,
  productBarcode,
  onCreated,
}: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [colorEnabled, setColorEnabled] = useState(true);
  const [sizeEnabled, setSizeEnabled] = useState(true);
  const [colors, setColors] = useState<string[]>(['Kırmızı', 'Mavi', 'Siyah']);
  const [sizes, setSizes] = useState<string[]>(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>([]);

  const [bulkStock, setBulkStock] = useState('0');
  const [bulkPrice, setBulkPrice] = useState('');
  const [drafts, setDrafts] = useState<DraftVariant[]>([]);

  const baseSku = (productSku ?? productBarcode).trim();

  const resetWizard = (): void => {
    setStep(1);
    setColorEnabled(true);
    setSizeEnabled(true);
    setColors(['Kırmızı', 'Mavi', 'Siyah']);
    setSizes(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
    setCustomAttributes([]);
    setBulkStock('0');
    setBulkPrice('');
    setDrafts([]);
  };

  const attributeAxes = useMemo(() => {
    const axes: { key: string; label: string; values: string[] }[] = [];
    if (colorEnabled && colors.length > 0) {
      axes.push({ key: 'color', label: 'Renk', values: colors });
    }
    if (sizeEnabled && sizes.length > 0) {
      axes.push({ key: 'size', label: 'Beden', values: sizes });
    }
    for (const attr of customAttributes) {
      if (attr.name.trim() && attr.values.length > 0) {
        axes.push({
          key: `custom:${attr.id}`,
          label: attr.name.trim(),
          values: attr.values,
        });
      }
    }
    return axes;
  }, [colorEnabled, colors, sizeEnabled, sizes, customAttributes]);

  const generateDrafts = (): DraftVariant[] => {
    if (attributeAxes.length === 0) {
      return [];
    }
    const combos = cartesianProduct(
      attributeAxes.map((a) =>
        a.values.map((v) => ({ axisKey: a.key, axisLabel: a.label, value: v })),
      ),
    );

    return combos.map((combo) => {
      const custom: Record<string, string> = {};
      let color: string | undefined;
      let size: string | undefined;

      for (const part of combo) {
        if (!part) {
          continue;
        }
        if (part.axisKey === 'color') {
          color = part.value;
        } else if (part.axisKey === 'size') {
          size = part.value;
        } else if (part.axisKey.startsWith('custom:')) {
          custom[part.axisLabel] = part.value;
        }
      }

      const key = buildCombinationKey({
        Renk: color,
        Beden: size,
        ...custom,
      });

      return {
        key,
        color,
        size,
        customAttributes: custom,
        included: true,
        stock: Number.parseInt(bulkStock, 10) || 0,
        price:
          bulkPrice.trim() === ''
            ? null
            : Number.parseFloat(bulkPrice.replace(',', '.')) || null,
        barcode: '',
      };
    });
  };

  const goToPreview = (): void => {
    const next = generateDrafts();
    if (next.length === 0) {
      toast.error('En az bir özellik ve değer seçin');
      return;
    }
    if (next.length > 200) {
      toast.error('En fazla 200 kombinasyon oluşturulabilir');
      return;
    }
    setDrafts(next);
    setStep(2);
  };

  const includedDrafts = drafts.filter((d) => d.included);

  const applyBulkValues = (): void => {
    const stock = Number.parseInt(bulkStock, 10) || 0;
    const priceTrim = bulkPrice.trim();
    const price =
      priceTrim === ''
        ? null
        : Number.parseFloat(priceTrim.replace(',', '.')) || null;
    setDrafts((prev) =>
      prev.map((d) => ({
        ...d,
        stock,
        price,
      })),
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = includedDrafts.map((d) => ({
        color: d.color,
        size: d.size,
        customAttributes:
          Object.keys(d.customAttributes).length > 0
            ? d.customAttributes
            : undefined,
        stock: d.stock,
        price: d.price,
        barcode: d.barcode.trim() || undefined,
      }));
      const { data } = await api.post<ProductVariantDto[]>(
        `/products/${productId}/variants/bulk`,
        { variants: payload },
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.length} varyant oluşturuldu`);
      setOpen(false);
      resetWizard();
      onCreated();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          resetWizard();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Sparkles className="mr-2 size-4" />
          Varyant sihirbazı
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Varyant oluşturma sihirbazı</DialogTitle>
          <DialogDescription>
            Adım {step}/4 —{' '}
            {step === 1
              ? 'Özellik seç'
              : step === 2
                ? 'Kombinasyon önizleme'
                : step === 3
                  ? 'Toplu değerler'
                  : 'Oluştur'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid gap-4 py-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="wiz-color">Renk özelliği</Label>
              <Switch
                id="wiz-color"
                checked={colorEnabled}
                onCheckedChange={setColorEnabled}
              />
            </div>
            {colorEnabled ? (
              <ChipInput
                label="Renk değerleri"
                values={colors}
                onChange={setColors}
                placeholder="Kırmızı, Mavi…"
              />
            ) : null}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="wiz-size">Beden özelliği</Label>
              <Switch
                id="wiz-size"
                checked={sizeEnabled}
                onCheckedChange={setSizeEnabled}
              />
            </div>
            {sizeEnabled ? (
              <ChipInput
                label="Beden değerleri"
                values={sizes}
                onChange={setSizes}
                placeholder="S, M, L…"
              />
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Özel özellikler</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCustomAttributes((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        name: '',
                        values: [],
                      },
                    ]);
                  }}
                >
                  <Plus className="mr-1 size-3" />
                  Özellik ekle
                </Button>
              </div>
              {customAttributes.map((attr) => (
                <div key={attr.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Özellik adı (ör. Malzeme)"
                      value={attr.name}
                      onChange={(e) => {
                        setCustomAttributes((prev) =>
                          prev.map((a) =>
                            a.id === attr.id
                              ? { ...a, name: e.target.value }
                              : a,
                          ),
                        );
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCustomAttributes((prev) =>
                          prev.filter((a) => a.id !== attr.id),
                        );
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <ChipInput
                    label={`${attr.name || 'Özel'} değerleri`}
                    values={attr.values}
                    onChange={(values) => {
                      setCustomAttributes((prev) =>
                        prev.map((a) =>
                          a.id === attr.id ? { ...a, values } : a,
                        ),
                      );
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="py-2">
            <p className="text-muted-foreground mb-3 text-sm">
              {drafts.length} kombinasyon — istemediklerinizi kaldırın
            </p>
            <div className="max-h-[360px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Renk</TableHead>
                    <TableHead>Beden</TableHead>
                    <TableHead>Diğer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map((d) => (
                    <TableRow key={d.key}>
                      <TableCell>
                        <Checkbox
                          checked={d.included}
                          onCheckedChange={(c) => {
                            setDrafts((prev) =>
                              prev.map((x) =>
                                x.key === d.key
                                  ? { ...x, included: c === true }
                                  : x,
                              ),
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>{d.color ?? '—'}</TableCell>
                      <TableCell>{d.size ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {Object.entries(d.customAttributes)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ') || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-sm">
              Seçili: <strong>{includedDrafts.length}</strong> varyant
            </p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Tüm varyantlara başlangıç stok</Label>
                <Input
                  inputMode="numeric"
                  value={bulkStock}
                  onChange={(e) => {
                    setBulkStock(e.target.value);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label>Tüm varyantlara fiyat (TRY)</Label>
                <Input
                  inputMode="decimal"
                  value={bulkPrice}
                  onChange={(e) => {
                    setBulkPrice(e.target.value);
                  }}
                />
              </div>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={applyBulkValues}>
              Toplu değerleri tabloya uygula
            </Button>
            <div className="max-h-[280px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Varyant</TableHead>
                    <TableHead>Stok</TableHead>
                    <TableHead>Fiyat</TableHead>
                    <TableHead>Barkod</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {includedDrafts.map((d) => (
                    <TableRow key={d.key}>
                      <TableCell className="text-sm">
                        {[d.color, d.size, ...Object.values(d.customAttributes)]
                          .filter(Boolean)
                          .join(' / ')}
                        <div className="text-muted-foreground font-mono text-[10px]">
                          {baseSku}-…
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-20"
                          inputMode="numeric"
                          value={String(d.stock)}
                          onChange={(e) => {
                            const n = Number.parseInt(e.target.value, 10);
                            setDrafts((prev) =>
                              prev.map((x) =>
                                x.key === d.key
                                  ? {
                                      ...x,
                                      stock: Number.isFinite(n) ? n : 0,
                                    }
                                  : x,
                              ),
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-24"
                          inputMode="decimal"
                          value={d.price !== null ? String(d.price) : ''}
                          onChange={(e) => {
                            const trim = e.target.value.trim();
                            const n =
                              trim === ''
                                ? null
                                : Number.parseFloat(trim.replace(',', '.'));
                            setDrafts((prev) =>
                              prev.map((x) =>
                                x.key === d.key
                                  ? {
                                      ...x,
                                      price:
                                        trim === ''
                                          ? null
                                          : Number.isFinite(n)
                                            ? n
                                            : x.price,
                                    }
                                  : x,
                              ),
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 font-mono text-xs"
                          value={d.barcode}
                          onChange={(e) => {
                            setDrafts((prev) =>
                              prev.map((x) =>
                                x.key === d.key
                                  ? { ...x, barcode: e.target.value }
                                  : x,
                              ),
                            );
                          }}
                          placeholder="Opsiyonel"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3 py-4">
            <p className="text-sm">
              <strong>{includedDrafts.length}</strong> varyant oluşturulacak.
            </p>
            <ul className="text-muted-foreground list-inside list-disc text-sm">
              <li>SKU otomatik üretilir ({baseSku}-…)</li>
              <li>Barkod boş bırakılan varyantlar sonradan atanabilir</li>
            </ul>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep((s) => s - 1);
                }}
              >
                Geri
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {step === 1 ? (
              <Button type="button" onClick={goToPreview}>
                İleri
              </Button>
            ) : null}
            {step === 2 ? (
              <Button
                type="button"
                disabled={includedDrafts.length === 0}
                onClick={() => {
                  setStep(3);
                }}
              >
                İleri
              </Button>
            ) : null}
            {step === 3 ? (
              <Button
                type="button"
                disabled={includedDrafts.length === 0}
                onClick={() => {
                  setStep(4);
                }}
              >
                İleri
              </Button>
            ) : null}
            {step === 4 ? (
              <Button
                type="button"
                disabled={createMutation.isPending || includedDrafts.length === 0}
                onClick={() => {
                  createMutation.mutate();
                }}
              >
                {createMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  `${includedDrafts.length} varyant oluştur`
                )}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
