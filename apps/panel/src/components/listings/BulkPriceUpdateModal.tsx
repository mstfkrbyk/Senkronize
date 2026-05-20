import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { Loader2 } from 'lucide-react';
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
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Listing } from '@/types/listing';

import { useBulkPriceUpdate } from '@/pages/listings/hooks/useListings';

export type BulkPriceUpdateType =
  | 'FIXED'
  | 'PERCENT_INCREASE'
  | 'PERCENT_DECREASE'
  | 'MATCH_BUYBOX';

const UPDATE_TYPE_OPTIONS: { value: BulkPriceUpdateType; label: string }[] = [
  { value: 'FIXED', label: 'Sabit fiyat' },
  { value: 'PERCENT_INCREASE', label: '% Artış' },
  { value: 'PERCENT_DECREASE', label: '% İndirim' },
  { value: 'MATCH_BUYBOX', label: "BuyBox'a eşitle" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedListings: Listing[];
  buyBoxPriceByKey?: Map<string, number>;
  activePlatforms: string[];
  onSuccess?: () => void;
}

function listingKey(listing: Listing): string {
  return `${listing.barcode}:${listing.platform}`;
}

function computeNewPrice(
  listing: Listing,
  updateType: BulkPriceUpdateType,
  value: number,
  buyBoxPriceByKey: Map<string, number>,
  minPrice?: number,
  maxPrice?: number,
): number | null {
  const current = Number(listing.salePrice);
  if (!Number.isFinite(current) || current <= 0) {
    return null;
  }

  let next: number;
  switch (updateType) {
    case 'FIXED':
      next = value;
      break;
    case 'PERCENT_INCREASE':
      next = current * (1 + value / 100);
      break;
    case 'PERCENT_DECREASE':
      next = current * (1 - value / 100);
      break;
    case 'MATCH_BUYBOX': {
      const bb = buyBoxPriceByKey.get(listingKey(listing));
      if (bb == null || !Number.isFinite(bb) || bb <= 0) {
        return null;
      }
      next = bb;
      break;
    }
    default:
      return null;
  }

  if (minPrice != null && Number.isFinite(minPrice)) {
    next = Math.max(next, minPrice);
  }
  if (maxPrice != null && Number.isFinite(maxPrice)) {
    next = Math.min(next, maxPrice);
  }

  const rounded = Math.round(next * 100) / 100;
  if (!Number.isFinite(rounded) || rounded <= 0) {
    return null;
  }
  return rounded;
}

export function BulkPriceUpdateModal({
  open,
  onOpenChange,
  selectedListings,
  buyBoxPriceByKey = new Map(),
  activePlatforms,
  onSuccess,
}: Props): ReactElement {
  const mutation = useBulkPriceUpdate();

  const [updateType, setUpdateType] = useState<BulkPriceUpdateType>('FIXED');
  const [value, setValue] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [targetPlatforms, setTargetPlatforms] = useState<Set<string>>(
    () => new Set(activePlatforms),
  );

  const minNum = minPrice.trim() ? Number(minPrice.replace(',', '.')) : undefined;
  const maxNum = maxPrice.trim() ? Number(maxPrice.replace(',', '.')) : undefined;
  const valueNum = value.trim() ? Number(value.replace(',', '.')) : undefined;

  const scopedListings = useMemo(() => {
    if (targetPlatforms.size === 0) {
      return selectedListings;
    }
    return selectedListings.filter((l) => targetPlatforms.has(l.platform));
  }, [selectedListings, targetPlatforms]);

  const preview = useMemo(() => {
    const updates: { id: string; price: number }[] = [];
    const skipped: string[] = [];

    if (updateType !== 'MATCH_BUYBOX' && (valueNum == null || !Number.isFinite(valueNum))) {
      return { updates, skipped, affected: 0 };
    }

    for (const listing of scopedListings) {
      const price = computeNewPrice(
        listing,
        updateType,
        valueNum ?? 0,
        buyBoxPriceByKey,
        minNum,
        maxNum,
      );
      if (price == null) {
        skipped.push(listing.id);
        continue;
      }
      if (Math.abs(price - Number(listing.salePrice)) < 0.005) {
        continue;
      }
      updates.push({ id: listing.id, price });
    }

    return { updates, skipped, affected: updates.length };
  }, [scopedListings, updateType, valueNum, buyBoxPriceByKey, minNum, maxNum]);

  const togglePlatform = (platform: string, checked: boolean): void => {
    setTargetPlatforms((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(platform);
      } else {
        next.delete(platform);
      }
      return next;
    });
  };

  const handleApply = (): void => {
    if (preview.affected === 0) {
      toast.error('Uygulanacak fiyat değişikliği bulunamadı');
      return;
    }
    mutation.mutate(preview.updates, {
      onSuccess: () => {
        onOpenChange(false);
        onSuccess?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Toplu fiyat güncelle</DialogTitle>
          <DialogDescription>
            Seçili {selectedListings.length} listeleme için fiyat kuralı uygulanır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor="bulk-price-type">Güncelleme tipi</Label>
            <Select
              value={updateType}
              onValueChange={(v) => {
                setUpdateType(v as BulkPriceUpdateType);
              }}
            >
              <SelectTrigger id="bulk-price-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPDATE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {updateType !== 'MATCH_BUYBOX' ? (
            <div className="grid gap-2">
              <Label htmlFor="bulk-price-value">
                {updateType === 'FIXED' ? 'Yeni fiyat (₺)' : 'Yüzde (%)'}
              </Label>
              <Input
                id="bulk-price-value"
                inputMode="decimal"
                placeholder={updateType === 'FIXED' ? '0,00' : '10'}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                }}
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>Hedef platformlar</Label>
            <div className="flex flex-wrap gap-2 rounded-md border p-3">
              {activePlatforms.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aktif platform yok</p>
              ) : (
                activePlatforms.map((platform) => {
                  const branding = getMarketplaceBranding(platform);
                  return (
                    <label
                      key={platform}
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5"
                    >
                      <Checkbox
                        checked={targetPlatforms.has(platform)}
                        onCheckedChange={(v) => {
                          togglePlatform(platform, v === true);
                        }}
                      />
                      <span className="text-sm">
                        <span aria-hidden>{branding.logo}</span> {branding.label}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="bulk-min-price">Min. fiyat (₺)</Label>
              <Input
                id="bulk-min-price"
                inputMode="decimal"
                placeholder="Opsiyonel"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bulk-max-price">Max. fiyat (₺)</Label>
              <Input
                id="bulk-max-price"
                inputMode="decimal"
                placeholder="Opsiyonel"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Önizleme</p>
            <p className="mt-1 text-muted-foreground">
              <Badge variant="secondary" className="mr-2 tabular-nums">
                {preview.affected}
              </Badge>
              listeleme güncellenecek
              {preview.skipped.length > 0 ? (
                <span className="ml-1 text-xs">
                  ({preview.skipped.length} atlandı)
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            İptal
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || preview.affected === 0}
            onClick={handleApply}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Uygula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
