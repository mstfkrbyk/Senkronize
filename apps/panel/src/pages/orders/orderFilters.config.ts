import type { FilterConfig } from '@/components/AdvancedFilters';
import { ORDER_STATUS_LABEL_TR } from '@/lib/order-status';
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import type { OrderStatus } from '@/types/order';

export const ORDER_PAGE_SIZE = 20;

export const ORDER_FILTER_DEFAULTS = {
  page: 1,
  limit: ORDER_PAGE_SIZE,
  platforms: [] as string[],
  statuses: [] as string[],
  startDate: '',
  endDate: '',
  search: '',
  cargoProvider: '',
  minTotal: undefined as number | undefined,
  maxTotal: undefined as number | undefined,
};

const ALL_STATUSES = Object.keys(ORDER_STATUS_LABEL_TR) as OrderStatus[];

export const ORDER_FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'platforms',
    label: 'Pazaryeri',
    type: 'multi_select',
    options: MARKETPLACE_OPTIONS.map((o) => ({ value: o.id, label: o.label })),
  },
  {
    key: 'statuses',
    label: 'Durum',
    type: 'multi_select',
    options: ALL_STATUSES.map((st) => ({
      value: st,
      label: ORDER_STATUS_LABEL_TR[st],
    })),
  },
  {
    key: 'startDate',
    label: 'Tarih aralığı',
    type: 'date_range',
    rangeEndKey: 'endDate',
  },
  {
    key: 'search',
    label: 'Arama',
    type: 'text',
    placeholder: 'Müşteri veya sipariş no',
  },
  {
    key: 'cargoProvider',
    label: 'Kargo firması',
    type: 'text',
    placeholder: 'Örn. Aras, Yurtiçi',
  },
  {
    key: 'minTotal',
    label: 'Tutar aralığı',
    type: 'number_range',
    rangeEndKey: 'maxTotal',
  },
];
