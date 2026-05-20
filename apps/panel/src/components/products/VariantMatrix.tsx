import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { LayoutGrid, List, Percent } from 'lucide-react';
import { toast } from 'sonner';

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  extractMatrixAxes,
  findVariantByColorSize,
  formatMoney,
  parseAttributes,
  parsePrice,
  stockCellClass,
  type ProductVariant,
} from '@/components/products/variant-utils';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BulkPriceUpdateForm } from '@/types/product';

interface VariantMatrixProps {
  productId: string;
  variants: ProductVariant[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onRefresh: () => void;
  renderActions?: (variant: ProductVariant) => ReactElement;
}

type ViewMode = 'matrix' | 'list';

function UpdateAllPricesDialog({
  productId,
  open,
  onOpenChange,
  onDone,
}: {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}): ReactElement {
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
      onOpenChange(false);
      onDone();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tüm fiyatları güncelle</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <Label>Güncelleme tipi</Label>
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
                <SelectItem value="fixed">Sabit tutar</SelectItem>
                <SelectItem value="set">Belirli fiyata ayarla</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.updateType !== 'set' ? (
            <div className="grid gap-2">
              <Label>Yön</Label>
              <Select
                value={form.direction}
                onValueChange={(v) => {
                  setForm((f) => ({
                    ...f,
                    direction: v as BulkPriceUpdateForm['direction'],
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Artır</SelectItem>
                  <SelectItem value="decrease">Azalt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label>Değer</Label>
            <Input
              inputMode="decimal"
              value={String(form.value)}
              onChange={(e) => {
                const n = Number.parseFloat(e.target.value.replace(',', '.'));
                setForm((f) => ({
                  ...f,
                  value: Number.isFinite(n) ? n : 0,
                }));
              }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Tüm varyantların fiyatları güncellenecek.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => {
              mutation.mutate();
            }}
          >
            Uygula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VariantInlineCell({
  productId,
  variant,
  field,
  onSaved,
}: {
  productId: string;
  variant: ProductVariant;
  field: 'stock' | 'price' | 'barcode' | 'sku';
  onSaved: () => void;
}): ReactElement {
  const initial =
    field === 'stock'
      ? String(variant.stock)
      : field === 'sku'
        ? variant.sku
        : field === 'barcode'
          ? variant.barcode ?? ''
          : variant.price === null || variant.price === undefined
            ? ''
            : String(variant.price);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);

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
        stock: Number.isFinite(n) ? Math.max(0, n) : variant.stock,
      });
      return;
    }
    if (field === 'barcode') {
      const trim = value.trim();
      patchMutation.mutate({ barcode: trim.length > 0 ? trim : null });
      return;
    }
    if (field === 'sku') {
      const trim = value.trim();
      if (!trim) {
        return;
      }
      patchMutation.mutate({ sku: trim });
      return;
    }
    const trim = value.trim();
    const n = trim === '' ? null : Number.parseFloat(trim.replace(',', '.'));
    patchMutation.mutate({
      price: trim === '' ? null : Number.isFinite(n) ? n : undefined,
    });
  };

  const display =
    field === 'stock'
      ? variant.stock.toLocaleString('tr-TR')
      : field === 'sku'
        ? variant.sku
        : field === 'barcode'
          ? variant.barcode ?? '—'
          : formatMoney(variant.price);

  if (!editing) {
    return (
      <TableCell
        className={cn(
          'cursor-pointer tabular-nums',
          (field === 'barcode' || field === 'sku') && 'font-mono text-xs',
        )}
        onClick={() => {
          setValue(initial);
          setEditing(true);
        }}
      >
        {display}
      </TableCell>
    );
  }

  return (
    <TableCell>
      <Input
        className="h-8"
        autoFocus
        inputMode={
          field === 'stock' ? 'numeric' : field === 'price' ? 'decimal' : 'text'
        }
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onBlur={() => {
          persist();
        }}
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

function MatrixCellPopover({
  productId,
  variant,
  onSaved,
}: {
  productId: string;
  variant: ProductVariant;
  onSaved: () => void;
}): ReactElement {
  const [stock, setStock] = useState(String(variant.stock));
  const [price, setPrice] = useState(
    parsePrice(variant.price) !== null ? String(parsePrice(variant.price)) : '',
  );
  const [sku, setSku] = useState(variant.sku);

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await api.patch(`/products/${productId}/variants/${variant.id}`, body);
    },
    onSuccess: () => {
      toast.success('Varyant güncellendi');
      onSaved();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const save = (): void => {
    const stockNum = Number.parseInt(stock, 10);
    const priceTrim = price.trim();
    const priceNum =
      priceTrim === ''
        ? null
        : Number.parseFloat(priceTrim.replace(',', '.'));
    patchMutation.mutate({
      stock: Number.isFinite(stockNum) ? Math.max(0, stockNum) : variant.stock,
      price: priceTrim === '' ? null : Number.isFinite(priceNum) ? priceNum : undefined,
      sku: sku.trim() || variant.sku,
    });
  };

  const attrs = parseAttributes(variant.attributes);

  return (
    <PopoverContent className="w-64" align="center">
      <div className="grid gap-3">
        <p className="text-sm font-medium">
          {[attrs.Renk, attrs.Beden].filter(Boolean).join(' / ') || variant.title}
        </p>
        <div className="grid gap-2">
          <Label htmlFor={`cell-sku-${variant.id}`}>SKU</Label>
          <Input
            id={`cell-sku-${variant.id}`}
            className="font-mono text-xs"
            value={sku}
            onChange={(e) => {
              setSku(e.target.value);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`cell-stock-${variant.id}`}>Stok</Label>
          <Input
            id={`cell-stock-${variant.id}`}
            inputMode="numeric"
            value={stock}
            onChange={(e) => {
              setStock(e.target.value);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`cell-price-${variant.id}`}>Fiyat (TRY)</Label>
          <Input
            id={`cell-price-${variant.id}`}
            inputMode="decimal"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={patchMutation.isPending}
          onClick={() => {
            save();
          }}
        >
          Kaydet
        </Button>
      </div>
    </PopoverContent>
  );
}

function ViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}): ReactElement {
  return (
    <div className="flex w-fit items-center gap-1 rounded-lg border p-1">
      <Button
        type="button"
        variant={viewMode === 'matrix' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => {
          onChange('matrix');
        }}
      >
        <LayoutGrid className="size-4" />
        Matris
      </Button>
      <Button
        type="button"
        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => {
          onChange('list');
        }}
      >
        <List className="size-4" />
        Liste
      </Button>
    </div>
  );
}

export function VariantMatrix({
  productId,
  variants,
  selectedIds,
  onSelectionChange,
  onRefresh,
  renderActions,
}: VariantMatrixProps): ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const { colors, sizes } = useMemo(
    () => extractMatrixAxes(variants),
    [variants],
  );

  const toggleSelect = (id: string, checked: boolean): void => {
    onSelectionChange(
      checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id),
    );
  };

  const toggleSelectAll = (checked: boolean): void => {
    onSelectionChange(checked ? variants.map((v) => v.id) : []);
  };

  const allSelected =
    variants.length > 0 && selectedIds.length === variants.length;

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <ViewToggle viewMode={viewMode} onChange={setViewMode} />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={variants.length === 0}
        onClick={() => {
          setPriceDialogOpen(true);
        }}
      >
        <Percent className="mr-2 size-4" />
        Tüm fiyatları güncelle
      </Button>
    </div>
  );

  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {toolbar}
        <UpdateAllPricesDialog
          productId={productId}
          open={priceDialogOpen}
          onOpenChange={setPriceDialogOpen}
          onDone={onRefresh}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(c) => {
                    toggleSelectAll(c === true);
                  }}
                  aria-label="Tümünü seç"
                />
              </TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Renk</TableHead>
              <TableHead>Beden</TableHead>
              <TableHead>Stok</TableHead>
              <TableHead>Fiyat</TableHead>
              <TableHead>Durum</TableHead>
              {renderActions ? <TableHead className="w-[88px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((v) => {
              const attrs = parseAttributes(v.attributes);
              return (
                <TableRow key={v.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(v.id)}
                      onCheckedChange={(c) => {
                        toggleSelect(v.id, c === true);
                      }}
                      aria-label="Varyant seç"
                    />
                  </TableCell>
                  <VariantInlineCell
                    productId={productId}
                    variant={v}
                    field="sku"
                    onSaved={onRefresh}
                  />
                  <TableCell>{attrs.Renk ?? '—'}</TableCell>
                  <TableCell>{attrs.Beden ?? '—'}</TableCell>
                  <VariantInlineCell
                    productId={productId}
                    variant={v}
                    field="stock"
                    onSaved={onRefresh}
                  />
                  <VariantInlineCell
                    productId={productId}
                    variant={v}
                    field="price"
                    onSaved={onRefresh}
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
                            onRefresh();
                          })
                          .catch((e: unknown) => {
                            toast.error(getApiErrorMessage(e));
                          });
                      }}
                    />
                  </TableCell>
                  {renderActions ? (
                    <TableCell>{renderActions(v)}</TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (colors.length === 0 || sizes.length === 0) {
    return (
      <div className="space-y-3">
        {toolbar}
        <UpdateAllPricesDialog
          productId={productId}
          open={priceDialogOpen}
          onOpenChange={setPriceDialogOpen}
          onDone={onRefresh}
        />
        <p className="text-muted-foreground text-sm">
          Matris görünümü için varyantlarda Renk ve Beden özellikleri gerekir.
          Liste görünümünü kullanabilirsiniz.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setViewMode('list');
          }}
        >
          Liste görünümüne geç
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      <UpdateAllPricesDialog
        productId={productId}
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        onDone={onRefresh}
      />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border bg-muted/50 px-3 py-2 text-left font-medium">
                Renk \ Beden
              </th>
              {sizes.map((size) => (
                <th
                  key={size}
                  className="border bg-muted/50 px-3 py-2 text-center font-medium"
                >
                  {size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.map((color) => (
              <tr key={color}>
                <td className="border bg-muted/30 px-3 py-2 font-medium">
                  {color}
                </td>
                {sizes.map((size) => {
                  const variant = findVariantByColorSize(
                    variants,
                    color,
                    size,
                  );
                  if (!variant) {
                    return (
                      <td
                        key={size}
                        className="border bg-muted/10 px-3 py-2 text-center text-muted-foreground"
                      >
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={size} className="border p-0">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              'flex h-full w-full min-w-[72px] flex-col items-center justify-center gap-0.5 px-2 py-3 tabular-nums transition-colors',
                              stockCellClass(variant.stock),
                            )}
                          >
                            <span className="font-mono text-[9px] opacity-70">
                              {variant.sku}
                            </span>
                            <span className="text-base font-semibold">
                              {variant.stock}
                            </span>
                            <span className="text-[10px] opacity-80">
                              {formatMoney(variant.price)}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <MatrixCellPopover
                          productId={productId}
                          variant={variant}
                          onSaved={onRefresh}
                        />
                      </Popover>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
