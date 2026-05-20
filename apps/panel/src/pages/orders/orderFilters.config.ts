import type { TFunction } from 'i18next';

import type { FilterConfig } from '@/components/AdvancedFilters';
import { ORDER_STATUS_I18N_KEY } from '@/lib/order-i18n';
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

const ALL_STATUSES = Object.keys(ORDER_STATUS_I18N_KEY) as OrderStatus[];

export function buildOrderFilterConfig(t: TFunction): FilterConfig[] {
  return [
    {
      key: 'platforms',
      label: t('orders.filters.platform'),
      type: 'multi_select',
      options: MARKETPLACE_OPTIONS.map((o) => ({ value: o.id, label: o.label })),
    },
    {
      key: 'statuses',
      label: t('orders.filters.status'),
      type: 'multi_select',
      options: ALL_STATUSES.map((st) => ({
        value: st,
        label: t(ORDER_STATUS_I18N_KEY[st]),
      })),
    },
    {
      key: 'startDate',
      label: t('orders.filters.dateRange'),
      type: 'date_range',
      rangeEndKey: 'endDate',
    },
    {
      key: 'search',
      label: t('orders.filters.search'),
      type: 'text',
      placeholder: t('orders.filters.searchPlaceholder'),
    },
    {
      key: 'cargoProvider',
      label: t('orders.filters.cargoProvider'),
      type: 'text',
      placeholder: t('orders.filters.cargoPlaceholder'),
    },
    {
      key: 'minTotal',
      label: t('orders.filters.amountRange'),
      type: 'number_range',
      rangeEndKey: 'maxTotal',
    },
  ];
}
