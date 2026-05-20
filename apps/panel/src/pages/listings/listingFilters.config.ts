import type { FilterConfig } from '@/components/AdvancedFilters';
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import type { ListingStockTier } from '@/types/listing';

export const LISTING_PAGE_SIZE = 20;

export const LISTING_FILTER_DEFAULTS = {
  page: 1,
  limit: LISTING_PAGE_SIZE,
  platforms: [] as string[],
  stockTier: undefined as ListingStockTier | undefined,
  minSalePrice: undefined as number | undefined,
  maxSalePrice: undefined as number | undefined,
  lastSyncAtSince: '',
  lastSyncAtUntil: '',
  category: '',
  approved: undefined as string | undefined,
  search: '',
};

const STOCK_TIER_OPTIONS: { value: ListingStockTier; label: string }[] = [
  { value: 'IN_STOCK', label: 'Stokta var (>20)' },
  { value: 'LOW', label: 'Düşük stok (1–20)' },
  { value: 'OUT', label: 'Stok yok' },
];

export const LISTING_FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'platforms',
    label: 'Pazaryeri',
    type: 'multi_select',
    options: MARKETPLACE_OPTIONS.map((o) => ({ value: o.id, label: o.label })),
  },
  {
    key: 'stockTier',
    label: 'Stok durumu',
    type: 'select',
    options: STOCK_TIER_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
  {
    key: 'minSalePrice',
    label: 'Fiyat aralığı',
    type: 'number_range',
    rangeEndKey: 'maxSalePrice',
  },
  {
    key: 'lastSyncAtSince',
    label: 'Son senkron',
    type: 'date_range',
    rangeEndKey: 'lastSyncAtUntil',
  },
  {
    key: 'category',
    label: 'Kategori',
    type: 'text',
    placeholder: 'Ürün kategorisi',
  },
  {
    key: 'approved',
    label: 'Onay durumu',
    type: 'select',
    options: [
      { value: 'true', label: 'Onaylı' },
      { value: 'false', label: 'Beklemede' },
    ],
  },
  {
    key: 'search',
    label: 'Arama',
    type: 'text',
    placeholder: 'Ürün adı veya barkod',
  },
];
