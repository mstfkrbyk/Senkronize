import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { cn } from '@/lib/utils';

import {
  extractMatrixAxes,
  findVariantByColorSize,
  formatMoney,
  parseAttributes,
  parsePrice,
  stockCellClass,
  type ProductVariant,
} from './variant-utils';

interface VariantMatrixProps {
  productId: string;
  variants: ProductVariant[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onStockChange: (variantId: string, newStock: number) => void;
  onPriceChange: (variantId: string, newPrice: number | null) => void;
  onRefresh: () => void;
  renderActions?: (variant: ProductVariant) => ReactElement;
}

type ViewMode = 'matrix' | 'list';

function VariantInlineCell({
  productId,
  variant,
  field,
  onSaved,
}: {
  productId: string;
  variant: ProductVariant;
  field: 'stock' | 'price' | 'barcode';
  onSaved: () => void;
}): ReactElement {
  const initial =
    field === 'stock'
      ? String(variant.stock)
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
    const trim = value.trim();
    const n = trim === '' ? null : Number.parseFloat(trim.replace(',', '.'));
    patchMutation.mutate({
      price: trim === '' ? null : Number.isFinite(n) ? n : undefined,
    });
  };

  const display =
    field === 'stock'
      ? variant.stock.toLocaleString('tr-TR')
      : field === 'barcode'
        ? variant.barcode ?? '—'
        : formatMoney(variant.price);

  if (!editing) {
    return (
      <TableCell
        className={cn(
          'cursor-pointer tabular-nums',
          field === 'barcode' && 'font-mono text-xs',
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
  onStockChange,
  onPriceChange,
}: {
  productId: string;
  variant: ProductVariant;
  onSaved: () => void;
  onStockChange: (variantId: string, newStock: number) => void;
  onPriceChange: (variantId: string, newPrice: number | null) => void;
}): ReactElement {
  const [stock, setStock] = useState(String(variant.stock));
  const [price, setPrice] = useState(
    parsePrice(variant.price) !== null ? String(parsePrice(variant.price)) : '',
  );
  const [barcode, setBarcode] = useState(variant.barcode ?? '');

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
    const nextStock = Number.isFinite(stockNum) ? Math.max(0, stockNum) : variant.stock;
    onStockChange(variant.id, nextStock);
    onPriceChange(
      variant.id,
      priceTrim === '' ? null : Number.isFinite(priceNum) ? priceNum : parsePrice(variant.price),
    );
    patchMutation.mutate({
      stock: nextStock,
      price: priceTrim === '' ? null : Number.isFinite(priceNum) ? priceNum : undefined,
      barcode: barcode.trim() || null,
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
        <div className="grid gap-2">
          <Label htmlFor={`cell-barcode-${variant.id}`}>Barkod</Label>
          <Input
            id={`cell-barcode-${variant.id}`}
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
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

export function VariantMatrix({
  productId,
  variants,
  selectedIds,
  onSelectionChange,
  onStockChange,
  onPriceChange,
  onRefresh,
  renderActions,
}: VariantMatrixProps): ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
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

  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
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
              <TableHead>Barkod</TableHead>
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
                  <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                  <TableCell>{attrs.Renk ?? '—'}</TableCell>
                  <TableCell>{attrs.Beden ?? '—'}</TableCell>
                  <VariantInlineCell
                    productId={productId}
                    variant={v}
                    field="barcode"
                    onSaved={onRefresh}
                  />
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
        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
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
      <ViewToggle viewMode={viewMode} onChange={setViewMode} />
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
                              'flex h-full w-full min-w-[56px] flex-col items-center justify-center px-2 py-3 tabular-nums transition-colors',
                              stockCellClass(variant.stock),
                            )}
                          >
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
                          onStockChange={onStockChange}
                          onPriceChange={onPriceChange}
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

function ViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-1 rounded-lg border p-1 w-fit">
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
