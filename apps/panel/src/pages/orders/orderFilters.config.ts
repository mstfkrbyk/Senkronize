import type { TFunction } from 'i18next';

import type { FilterConfig } from '@/components/AdvancedFilters';
import { CARGO_PROVIDER_OPTIONS } from '@/lib/cargo-providers';
import { ORDER_STATUS_I18N_KEY } from '@/lib/order-i18n';
import { INVOICE_STATUS_OPTIONS } from '@/pages/invoices/invoice-utils';
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
  invoiceLink: 'all',
  invoiceStatus: 'all',
};

const ALL_STATUSES = Object.keys(ORDER_STATUS_I18N_KEY) as OrderStatus[];

export function buildOrderFilterConfig(
  t: TFunction,
  options?: { includeInvoiceFilters?: boolean },
): FilterConfig[] {
  const base: FilterConfig[] = [
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
      type: 'select',
      options: [
        { value: '', label: 'Tümü' },
        ...CARGO_PROVIDER_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      ],
    },
    {
      key: 'minTotal',
      label: t('orders.filters.amountRange'),
      type: 'number_range',
      rangeEndKey: 'maxTotal',
    },
  ];

  if (!options?.includeInvoiceFilters) {
    return base;
  }

  return [
    ...base,
    {
      key: 'invoiceLink',
      label: t('orders.filters.invoiceLink'),
      type: 'select',
      options: [
        { value: 'all', label: t('orders.filters.invoiceLinkAll') },
        { value: 'linked', label: t('orders.filters.invoiceLinkWith') },
        { value: 'unlinked', label: t('orders.filters.invoiceLinkWithout') },
      ],
    },
    {
      key: 'invoiceStatus',
      label: t('orders.filters.invoiceStatus'),
      type: 'select',
      options: [
        { value: 'all', label: t('orders.filters.invoiceStatusAll') },
        ...INVOICE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      ],
    },
  ];
}
