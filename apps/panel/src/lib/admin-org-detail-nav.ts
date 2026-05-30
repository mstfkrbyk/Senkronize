export type AdminOrgDetailTab =
  | 'settings'
  | 'general'
  | 'users'
  | 'connections'
  | 'orders'
  | 'audit'
  | 'invoices';

const TAB_IDS: AdminOrgDetailTab[] = [
  'settings',
  'general',
  'users',
  'connections',
  'orders',
  'audit',
  'invoices',
];

export function isAdminOrgDetailTab(
  value: string | null,
): value is AdminOrgDetailTab {
  return value !== null && TAB_IDS.includes(value as AdminOrgDetailTab);
}

export function adminOrgDetailUrl(
  orgId: string,
  tab?: AdminOrgDetailTab,
): string {
  const base = `/admin/organizations/${orgId}`;
  if (tab && tab !== 'general') {
    return `${base}?tab=${encodeURIComponent(tab)}`;
  }
  return base;
}
