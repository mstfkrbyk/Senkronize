import type { SubStatus } from '@/types/admin';

export const ADMIN_SUBSCRIPTION_FILTER_DEFAULTS = {
  status: 'ALL' as SubStatus | 'ALL',
} as const;
