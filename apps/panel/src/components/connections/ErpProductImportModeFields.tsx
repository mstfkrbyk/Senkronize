import type { ReactElement } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ErpProductImportMode } from '@/hooks/useErpSyncSettings';

export function normalizeProductImportMode(
  value: ErpProductImportMode | string | null | undefined,
): ErpProductImportMode {
  if (value === 'ECOMMERCE_ONLY' || value === 'CATEGORY' || value === 'ALL') {
    return value;
  }
  return 'ECOMMERCE_ONLY';
}

interface Props {
  productImportMode: ErpProductImportMode;
  erpCategoryIds: string[];
  onProductImportModeChange: (mode: ErpProductImportMode) => void;
  onCategoryIdsChange: (ids: string[]) => void;
  idPrefix?: string;
  compact?: boolean;
}

export function ErpProductImportModeFields({
  productImportMode,
  erpCategoryIds,
  onProductImportModeChange,
  onCategoryIdsChange,
  idPrefix = 'erp-import',
  compact = false,
}: Props): ReactElement {
  const mode = normalizeProductImportMode(productImportMode);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4 rounded-lg border bg-card p-4 shadow-sm'}>
      {!compact ? (
        <div>
          <p className="font-medium">Ürün içe aktarma kapsamı</p>
          <p className="text-xs text-muted-foreground">
            BizimHesap&apos;tan hangi ürünlerin alınacağını seçin. Varsayılan: yalnızca e-ticaret
            işaretli ürünler.
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-mode`}>Filtre modu</Label>
        <Select
          value={mode}
          onValueChange={(value) => {
            onProductImportModeChange(normalizeProductImportMode(value));
          }}
        >
          <SelectTrigger id={`${idPrefix}-mode`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ECOMMERCE_ONLY">
              E-ticaret ürünleri (isEcommerce)
            </SelectItem>
            <SelectItem value="CATEGORY">Kategori filtresi (ör. E-Ticaret)</SelectItem>
            <SelectItem value="ALL">Tüm ürünler</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'CATEGORY' ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-categories`}>BizimHesap kategori ID veya adları</Label>
          <Input
            id={`${idPrefix}-categories`}
            placeholder="Örn: E-Ticaret, Elektrik"
            value={erpCategoryIds.join(', ')}
            onChange={(event) => {
              const ids = event.target.value
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean);
              onCategoryIdsChange(ids);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Virgülle ayırın. Kategori adı veya ID eşleşir (E-Ticaret / E-TİCARET normalize edilir).
          </p>
        </div>
      ) : null}
    </div>
  );
}
