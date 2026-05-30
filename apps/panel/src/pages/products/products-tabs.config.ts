import type { AccountingMode } from '@/lib/accounting-mode';
import {
  shouldPlaceStockInEcommerce,
  shouldPlaceStockInNativeAccounting,
  type NavCatalogContext,
} from '@/lib/nav-match';
import { hasOrgProductLine } from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

import {
  STOCK_TABS,
  type StockTabDefinition,
  type StockTabId,
} from '../stock/stock-tabs.config';

export const PRODUCT_CATALOG_TAB_ID = 'catalog' as const;

export type ProductCatalogTabId = typeof PRODUCT_CATALOG_TAB_ID;

export type ProductTabId = ProductCatalogTabId | StockTabId;

export interface ProductTabDefinition {
  id: ProductTabId;
  labelKey: string;
  cardDescKey?: string;
}

const CATALOG_TAB: ProductTabDefinition = {
  id: PRODUCT_CATALOG_TAB_ID,
  labelKey: 'products.tabs.catalog',
};

const STOCK_PRODUCT_TABS: ProductTabDefinition[] = STOCK_TABS.map(
  (tab: StockTabDefinition) => ({
    id: tab.id,
    labelKey: tab.labelKey,
    cardDescKey: tab.cardDescKey,
  }),
);

export function isProductTabId(value: string | null): value is ProductTabId {
  if (value === PRODUCT_CATALOG_TAB_ID) {
    return true;
  }
  return STOCK_TABS.some((tab) => tab.id === value);
}

export function resolveVisibleProductTabs(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): ProductTabDefinition[] {
  const ctx: NavCatalogContext = { orgProducts, accountingMode };
  const tabs: ProductTabDefinition[] = [];
  if (hasOrgProductLine(orgProducts, 'INTEGRATION')) {
    tabs.push(CATALOG_TAB);
  }
  if (
    shouldPlaceStockInEcommerce(ctx) ||
    shouldPlaceStockInNativeAccounting(ctx)
  ) {
    tabs.push(...STOCK_PRODUCT_TABS);
  }
  return tabs;
}

export function defaultProductTab(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): ProductTabId {
  const visible = resolveVisibleProductTabs(orgProducts, accountingMode);
  return visible[0]?.id ?? PRODUCT_CATALOG_TAB_ID;
}

export function getProductTabDefinition(id: ProductTabId): ProductTabDefinition {
  if (id === PRODUCT_CATALOG_TAB_ID) {
    return CATALOG_TAB;
  }
  const stockTab = STOCK_TABS.find((tab) => tab.id === id);
  if (!stockTab) {
    return CATALOG_TAB;
  }
  return {
    id: stockTab.id,
    labelKey: stockTab.labelKey,
    cardDescKey: stockTab.cardDescKey,
  };
}
