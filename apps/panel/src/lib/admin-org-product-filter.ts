export const ADMIN_ORG_PRODUCT_FILTER_VALUES = [
  'INTEGRATION',
  'ACCOUNTING',
  'BUNDLE',
] as const;

export type AdminOrgProductFilter = (typeof ADMIN_ORG_PRODUCT_FILTER_VALUES)[number];

export const ADMIN_ORG_PRODUCT_FILTER_LABEL: Record<AdminOrgProductFilter, string> = {
  INTEGRATION: 'Entegrasyon',
  ACCOUNTING: 'Muhasebe',
  BUNDLE: 'Paket',
};

export type AdminOrgProductFilterValue = AdminOrgProductFilter | 'all';

export function isAdminOrgProductFilter(
  value: string | null,
): value is AdminOrgProductFilter {
  return (
    value !== null &&
    (ADMIN_ORG_PRODUCT_FILTER_VALUES as readonly string[]).includes(value)
  );
}

export function readAdminOrgProductFilterParam(
  productParam: string | null,
): AdminOrgProductFilterValue {
  return isAdminOrgProductFilter(productParam) ? productParam : 'all';
}
