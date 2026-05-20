import type { FilterConfig } from '@/components/AdvancedFilters';
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';

import type { ProductStockStatusFilter } from './productStockStatus';

export const PRODUCT_PAGE_SIZE = 20;

export const PRODUCT_FILTER_DEFAULTS = {
  page: 1,
  search: '',
  category: '',
  platform: undefined as string | undefined,
  stockStatus: 'all' as ProductStockStatusFilter,
  minPrice: undefined as number | undefined,
  maxPrice: undefined as number | undefined,
  hasVariants: undefined as string | undefined,
  isActive: undefined as string | undefined,
  minCostPrice: undefined as number | undefined,
  maxCostPrice: undefined as number | undefined,
};

export const PRODUCT_FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'search',
    label: 'Arama',
    type: 'text',
    placeholder: 'Ürün adı, barkod veya SKU',
  },
  {
    key: 'category',
    label: 'Kategori',
    type: 'text',
    placeholder: 'Kategori adı',
  },
  {
    key: 'platform',
    label: 'Platform',
    type: 'select',
    options: MARKETPLACE_OPTIONS.map((o) => ({ value: o.id, label: o.label })),
  },
  {
    key: 'stockStatus',
    label: 'Stok durumu',
    type: 'select',
    options: [
      { value: 'low', label: 'Düşük' },
      { value: 'out', label: 'Tükendi' },
      { value: 'ok', label: 'Yeterli' },
    ],
  },
  {
    key: 'minPrice',
    label: 'Fiyat aralığı',
    type: 'number_range',
    rangeEndKey: 'maxPrice',
  },
  {
    key: 'hasVariants',
    label: 'Varyant',
    type: 'select',
    options: [
      { value: 'true', label: 'Varyantlı' },
      { value: 'false', label: 'Varyantsız' },
    ],
  },
  {
    key: 'isActive',
    label: 'Durum',
    type: 'select',
    options: [
      { value: 'true', label: 'Aktif' },
      { value: 'false', label: 'Pasif' },
    ],
  },
  {
    key: 'minCostPrice',
    label: 'Maliyet aralığı',
    type: 'number_range',
    rangeEndKey: 'maxCostPrice',
  },
];
