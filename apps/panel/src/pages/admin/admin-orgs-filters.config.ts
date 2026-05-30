import { ADMIN_LIST_DEFAULT_LIMIT } from '@/lib/admin-list-constants';

export const ADMIN_ORG_FILTER_DEFAULTS = {
  page: 1,
  limit: ADMIN_LIST_DEFAULT_LIMIT,
  search: '',
  plan: 'all',
  status: 'all',
  accountingMode: 'all',
};

export type AdminOrgUrlFilters = typeof ADMIN_ORG_FILTER_DEFAULTS;
