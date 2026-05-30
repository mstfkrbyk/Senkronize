import type { FilterConfig } from '@/components/AdvancedFilters';

import { invoicesT } from './translations';

export const INVOICE_FILTER_DEFAULTS = {
  status: 'all',
  search: '',
  startDate: '',
  endDate: '',
  page: 1,
} as const;

export type InvoiceUrlFilters = {
  status: string;
  search: string;
  startDate: string;
  endDate: string;
  page: number;
};

export const INVOICE_FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'search',
    label: invoicesT('filters.customer'),
    type: 'text',
    placeholder: invoicesT('filters.customerPlaceholder'),
  },
  {
    key: 'startDate',
    label: invoicesT('filters.startDate'),
    type: 'date_range',
    rangeEndKey: 'endDate',
  },
];
