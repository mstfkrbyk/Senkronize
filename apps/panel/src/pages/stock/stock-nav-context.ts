import type { AccountingMode } from '@/lib/accounting-mode';
import {
  NAV_GROUP_LABEL_KEYS,
  shouldPlaceStockInEcommerce,
  shouldPlaceStockInNativeAccounting,
  type NavCatalogContext,
} from '@/lib/nav-match';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { hasOrgProductLine } from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

/**
 * Kenar çubuğunda stok grubu gizli olsa bile (ör. çift hat + mod)
 * stok ekranları doğru ürün hattı bağlamını korur.
 */
export function resolveStockNavGroupLabel(
  groupLabel: string | undefined,
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
  translate: (key: string) => string,
): string | undefined {
  if (groupLabel != null && groupLabel.length > 0) {
    return groupLabel;
  }

  const ctx: NavCatalogContext = { orgProducts, accountingMode };
  if (shouldPlaceStockInNativeAccounting(ctx)) {
    return translate(NAV_GROUP_LABEL_KEYS.nativeAccounting);
  }
  if (shouldPlaceStockInEcommerce(ctx)) {
    return translate(NAV_GROUP_LABEL_KEYS.ecommerce);
  }
  if (hasOrgProductLine(orgProducts, 'ACCOUNTING')) {
    return translate(NAV_GROUP_LABEL_KEYS.nativeAccounting);
  }
  if (hasOrgProductLine(orgProducts, 'INTEGRATION')) {
    return translate(NAV_GROUP_LABEL_KEYS.ecommerce);
  }
  return groupLabel;
}

export function formatStockNavContext(
  groupLabel: string | undefined,
  pageLabel: string,
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
  translate: (key: string) => string,
  leafLabel?: string,
): string {
  return formatNavPageContext(
    resolveStockNavGroupLabel(
      groupLabel,
      orgProducts,
      accountingMode,
      translate,
    ),
    pageLabel,
    leafLabel,
  );
}
