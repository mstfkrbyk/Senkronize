import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarIcon, ChevronDown, Filter } from 'lucide-react';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
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
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import type {
  BuyBoxStatusFilter,
  ListingFilters as ListingFiltersState,
  ListingStatus,
  ListingStockTier,
} from '@/types/listing';

interface Props {
  filters: ListingFiltersState;
  onChange: (next: ListingFiltersState) => void;
  searchInput?: string;
  onSearchInputChange?: (value: string) => void;
  showBuyBoxFilter?: boolean;
}

const DEFAULT_LIMIT = 20;

const STOCK_TIER_OPTIONS: { value: ListingStockTier; label: string }[] = [
  { value: 'IN_STOCK', label: 'Stokta var (>20)' },
  { value: 'LOW', label: 'Düşük stok (1–20)' },
  { value: 'OUT', label: 'Stok yok' },
];

const STATUS_OPTIONS: { value: ListingStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tüm durumlar' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'INACTIVE', label: 'Pasif' },
  { value: 'PENDING', label: 'Bekleyen' },
  { value: 'OUT_OF_STOCK', label: 'Reddedilen / stok yok' },
];

const BUYBOX_STATUS_OPTIONS: { value: BuyBoxStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Tümü' },
  { value: 'WINNING', label: 'Kazanıyor' },
  { value: 'LOSING', label: 'Kaybediyor' },
];

function parsePlatformsCsv(csv: string | undefined): string[] {
  if (!csv?.trim()) {
    return [];
  }
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function countActiveFilters(f: ListingFiltersState, searchDraft: string): number {
  let n = 0;
  if (f.platforms?.trim()) {
    n += 1;
  } else if (f.platform) {
    n += 1;
  }
  if (f.approved !== undefined) {
    n += 1;
  }
  if (f.stockTier) {
    n += 1;
  }
  if (f.status) {
    n += 1;
  }
  if (f.stockMin !== undefined || f.stockMax !== undefined) {
    n += 1;
  }
  if (f.buyBoxStatus && f.buyBoxStatus !== 'ALL') {
    n += 1;
  }
  if (f.minSalePrice !== undefined || f.maxSalePrice !== undefined) {
    n += 1;
  }
  if (f.lastSyncAtSince?.trim() || f.lastSyncAtUntil?.trim()) {
    n += 1;
  }
  if (f.category?.trim()) {
    n += 1;
  }
  if (searchDraft.trim()) {
    n += 1;
  }
  return n;
}

export function ListingFilters({
  filters,
  onChange,
  searchInput,
  onSearchInputChange,
  showBuyBoxFilter = false,
}: Props): ReactElement {
  const [syncFromOpen, setSyncFromOpen] = useState(false);
  const [syncToOpen, setSyncToOpen] = useState(false);

  const searchControlled =
    searchInput !== undefined && onSearchInputChange !== undefined;
  const searchDraft = searchControlled ? searchInput : (filters.search ?? '');

  const selectedPlatforms = useMemo(
    () => new Set(parsePlatformsCsv(filters.platforms)),
    [filters.platforms],
  );

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters, searchDraft),
    [filters, searchDraft],
  );

  const setField = <K extends keyof ListingFiltersState>(
    key: K,
    value: ListingFiltersState[K] | undefined,
  ): void => {
    onChange({
      ...filters,
      [key]: value,
      page: 1,
    });
  };

  const togglePlatform = (id: string, checked: boolean): void => {
    const next = new Set(selectedPlatforms);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    const csv = [...next].sort().join(',');
    onChange({
      ...filters,
      platforms: csv.length > 0 ? csv : undefined,
      platform: undefined,
      page: 1,
    });
  };

  const handleClear = (): void => {
    onSearchInputChange?.('');
    onChange({ page: 1, limit: filters.limit ?? DEFAULT_LIMIT });
  };

  const approvedValue =
    filters.approved === undefined
      ? 'all'
      : filters.approved
        ? 'approved'
        : 'pending';

  const syncFromDate = filters.lastSyncAtSince
    ? new Date(filters.lastSyncAtSince)
    : undefined;
  const syncToDate = filters.lastSyncAtUntil
    ? new Date(filters.lastSyncAtUntil)
    : undefined;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
          Filtreler
          {activeFilterCount > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {activeFilterCount}
            </Badge>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          Filtreleri temizle
        </Button>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
        <div className="grid gap-2 md:min-w-[200px]">
          <Label>Pazaryeri (çoklu)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="justify-between font-normal"
                aria-expanded={undefined}
              >
                {selectedPlatforms.size === 0
                  ? 'Tümü'
                  : `${String(selectedPlatforms.size)} seçili`}
                <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="max-h-64 overflow-y-auto p-2">
                {MARKETPLACE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedPlatforms.has(opt.id)}
                      onCheckedChange={(v) => {
                        togglePlatform(opt.id, v === true);
                      }}
                    />
                    <span className="text-sm">
                      <span className="mr-1" aria-hidden>
                        {opt.logo}
                      </span>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2 md:min-w-[180px]">
          <Label htmlFor="listing-status">Durum</Label>
          <Select
            value={filters.status ?? 'ALL'}
            onValueChange={(v) =>
              setField(
                'status',
                v === 'ALL' ? undefined : (v as ListingStatus),
              )
            }
          >
            <SelectTrigger id="listing-status">
              <SelectValue placeholder="Tüm durumlar" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showBuyBoxFilter ? (
          <div className="grid gap-2 md:min-w-[180px]">
            <Label htmlFor="listing-buybox-status">BuyBox durumu</Label>
            <Select
              value={filters.buyBoxStatus ?? 'ALL'}
              onValueChange={(v) =>
                setField(
                  'buyBoxStatus',
                  v === 'ALL' ? undefined : (v as BuyBoxStatusFilter),
                )
              }
            >
              <SelectTrigger id="listing-buybox-status">
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                {BUYBOX_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="grid gap-2 md:min-w-[180px]">
          <Label htmlFor="listing-stock-tier">Stok durumu</Label>
          <Select
            value={filters.stockTier ?? 'all'}
            onValueChange={(v) =>
              setField(
                'stockTier',
                v === 'all' ? undefined : (v as ListingStockTier),
              )
            }
          >
            <SelectTrigger id="listing-stock-tier">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {STOCK_TIER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 md:min-w-[120px]">
          <Label htmlFor="listing-price-min">Min. fiyat</Label>
          <Input
            id="listing-price-min"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0"
            value={filters.minSalePrice ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setField(
                'minSalePrice',
                v === '' ? undefined : Number(v.replace(',', '.')),
              );
            }}
          />
        </div>
        <div className="grid gap-2 md:min-w-[120px]">
          <Label htmlFor="listing-price-max">Max. fiyat</Label>
          <Input
            id="listing-price-max"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="—"
            value={filters.maxSalePrice ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setField(
                'maxSalePrice',
                v === '' ? undefined : Number(v.replace(',', '.')),
              );
            }}
          />
        </div>

        <div className="grid gap-2 md:min-w-[100px]">
          <Label htmlFor="listing-stock-min">Stok min</Label>
          <Input
            id="listing-stock-min"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Min"
            value={filters.stockMin ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setField(
                'stockMin',
                v === '' ? undefined : Math.round(Number(v)),
              );
            }}
          />
        </div>
        <div className="grid gap-2 md:min-w-[100px]">
          <Label htmlFor="listing-stock-max">Stok max</Label>
          <Input
            id="listing-stock-max"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Max"
            value={filters.stockMax ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setField(
                'stockMax',
                v === '' ? undefined : Math.round(Number(v)),
              );
            }}
          />
        </div>

        <div className="grid gap-2 md:min-w-[140px]">
          <Label>Son senkron (başlangıç)</Label>
          <Popover open={syncFromOpen} onOpenChange={setSyncFromOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="justify-start font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" aria-hidden />
                {syncFromDate
                  ? format(syncFromDate, 'd MMM yyyy', { locale: tr })
                  : 'Seç'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={syncFromDate}
                onSelect={(d) => {
                  setField(
                    'lastSyncAtSince',
                    d ? format(d, 'yyyy-MM-dd') : undefined,
                  );
                  setSyncFromOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2 md:min-w-[140px]">
          <Label>Son senkron (bitiş)</Label>
          <Popover open={syncToOpen} onOpenChange={setSyncToOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="justify-start font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" aria-hidden />
                {syncToDate
                  ? format(syncToDate, 'd MMM yyyy', { locale: tr })
                  : 'Seç'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={syncToDate}
                onSelect={(d) => {
                  setField(
                    'lastSyncAtUntil',
                    d ? format(d, 'yyyy-MM-dd') : undefined,
                  );
                  setSyncToOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2 md:min-w-[160px]">
          <Label htmlFor="listing-category">Kategori</Label>
          <Input
            id="listing-category"
            placeholder="Ürün kategorisi ara"
            value={filters.category ?? ''}
            onChange={(e) =>
              setField(
                'category',
                e.target.value.trim() ? e.target.value : undefined,
              )
            }
          />
        </div>

        <div className="grid gap-2 md:min-w-[160px]">
          <Label htmlFor="listing-approved">Onay durumu</Label>
          <Select
            value={approvedValue}
            onValueChange={(v) => {
              if (v === 'all') {
                setField('approved', undefined);
              } else if (v === 'approved') {
                setField('approved', true);
              } else {
                setField('approved', false);
              }
            }}
          >
            <SelectTrigger id="listing-approved">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="approved">Onaylı</SelectItem>
              <SelectItem value="pending">Beklemede</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-0 flex-1 gap-2 md:min-w-[200px]">
          <Label htmlFor="listing-search">Ara</Label>
          <Input
            id="listing-search"
            placeholder="Ürün adı veya barkod"
            value={searchControlled ? searchInput : (filters.search ?? '')}
            onChange={(e) => {
              const v = e.target.value;
              if (searchControlled) {
                onSearchInputChange(v);
              } else {
                setField('search', v ? v : undefined);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
