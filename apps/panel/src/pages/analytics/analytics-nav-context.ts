import { NAV_GROUP_LABEL_KEYS } from '@/lib/nav-match';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { hasOrgProductLine } from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

/**
 * Entegrasyon hattında kenar çubuğu gizli olsa bile «E-Ticaret > Analitik» bağlamını korur.
 */
export function resolveAnalyticsNavGroupLabel(
  groupLabel: string | undefined,
  orgProducts: OrgProductLine[] | undefined,
  translate: (key: string) => string,
): string | undefined {
  if (groupLabel != null && groupLabel.length > 0) {
    return groupLabel;
  }
  if (hasOrgProductLine(orgProducts, 'INTEGRATION')) {
    return translate(NAV_GROUP_LABEL_KEYS.ecommerce);
  }
  return groupLabel;
}

export function formatAnalyticsNavContext(
  groupLabel: string | undefined,
  pageLabel: string,
  orgProducts: OrgProductLine[] | undefined,
  translate: (key: string) => string,
): string {
  return formatNavPageContext(
    resolveAnalyticsNavGroupLabel(groupLabel, orgProducts, translate),
    pageLabel,
  );
}
