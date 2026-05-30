import { NAV_GROUP_LABEL_KEYS } from '@/lib/nav-match';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { hasOrgProductLine } from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

export const CUSTOMERS_SEGMENTS_LEAF_LABEL = 'Segmentler';

/**
 * Kenar çubuğunda ön muhasebe grubu gizli olsa bile (ör. paket + EXTERNAL_ERP)
 * müşteri ekranları «Ön Muhasebe > Müşteriler» bağlamını korur.
 */
export function resolveCustomersNavGroupLabel(
  groupLabel: string | undefined,
  orgProducts: OrgProductLine[] | undefined,
  translate: (key: string) => string,
): string | undefined {
  if (groupLabel != null && groupLabel.length > 0) {
    return groupLabel;
  }
  if (hasOrgProductLine(orgProducts, 'ACCOUNTING')) {
    return translate(NAV_GROUP_LABEL_KEYS.nativeAccounting);
  }
  return groupLabel;
}

export function formatCustomersNavContext(
  groupLabel: string | undefined,
  pageLabel: string,
  orgProducts: OrgProductLine[] | undefined,
  translate: (key: string) => string,
  leafLabel?: string,
): string {
  return formatNavPageContext(
    resolveCustomersNavGroupLabel(groupLabel, orgProducts, translate),
    pageLabel,
    leafLabel,
  );
}

/** `/customers/segments` üst bağlam satırı */
export function formatCustomerSegmentsNavContext(
  groupLabel: string | undefined,
  customersPageLabel: string,
  orgProducts: OrgProductLine[] | undefined,
  translate: (key: string) => string,
): string {
  return formatCustomersNavContext(
    groupLabel,
    customersPageLabel,
    orgProducts,
    translate,
    CUSTOMERS_SEGMENTS_LEAF_LABEL,
  );
}
