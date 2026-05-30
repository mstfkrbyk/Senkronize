import { ADMIN_LIST_DEFAULT_LIMIT } from '@/lib/admin-list-constants';

export const ADMIN_USER_FILTER_DEFAULTS = {
  page: 1,
  limit: ADMIN_LIST_DEFAULT_LIMIT,
  search: '',
  orgId: 'all',
  role: 'all',
};

export type AdminUserUrlFilters = typeof ADMIN_USER_FILTER_DEFAULTS;
