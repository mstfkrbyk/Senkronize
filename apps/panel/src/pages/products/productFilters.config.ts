import type { FilterConfig } from '@/components/AdvancedFilters';

export const PRODUCT_PAGE_SIZE = 20;

export const PRODUCT_FILTER_DEFAULTS = {
  page: 1,
  search: '',
  category: '',
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
