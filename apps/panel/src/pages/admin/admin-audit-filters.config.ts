import { ADMIN_LIST_DEFAULT_LIMIT } from '@/lib/admin-list-constants';

export const ADMIN_AUDIT_FILTER_DEFAULTS = {
  page: 1,
  limit: ADMIN_LIST_DEFAULT_LIMIT,
};

export type AdminAuditUrlFilters = typeof ADMIN_AUDIT_FILTER_DEFAULTS;
