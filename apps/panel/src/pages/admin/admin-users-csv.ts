import { format } from 'date-fns';
import type { TFunction } from 'i18next';

import i18n from '@/i18n';
import { api } from '@/lib/api';
import type { AdminOrgProductFilterValue } from '@/lib/admin-org-product-filter';

type Translate = TFunction;

function resolveT(t?: Translate): Translate {
  if (t) {
    return t;
  }
  return ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { lng: 'tr', ...options })) as Translate;
}

export type AdminUsersCsvExportFilters = {
  search?: string;
  orgId?: string;
  role?: string;
  product?: AdminOrgProductFilterValue;
};

function triggerCsvDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function defaultAdminUsersCsvFilename(t?: Translate): string {
  const tr = resolveT(t);
  const date = format(new Date(), 'yyyy-MM-dd');
  return tr('admin.users.filename', { date });
}

/** Sunucu CSV dışa aktarma (`GET /admin/users/export?format=csv`). */
export async function downloadAdminUsersCsvFromServer(
  filters: AdminUsersCsvExportFilters,
  filename?: string,
  t?: Translate,
): Promise<void> {
  const response = await api.get('/admin/users/export', {
    params: {
      format: 'csv',
      search: filters.search?.trim() || undefined,
      orgId: filters.orgId,
      role: filters.role,
      product: filters.product === 'all' ? undefined : filters.product,
    },
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  triggerCsvDownload(blob, filename ?? defaultAdminUsersCsvFilename(t));
}
