import type { AccountingMode } from '@/lib/accounting-mode';
import {
  shouldPlaceStockInEcommerce,
  shouldPlaceStockInNativeAccounting,
  type NavCatalogContext,
} from '@/lib/nav-match';
import type { OrgProductLine } from '@/types/auth';

export const STOCK_TAB_IDS = [
  'status',
  'warehouses',
  'movements',
  'transfers',
  'forecast',
] as const;

export type StockTabId = (typeof STOCK_TAB_IDS)[number];

export interface StockTabDefinition {
  id: StockTabId;
  labelKey: string;
  /** Sekme kartı açıklaması; yoksa CardDescription gösterilmez */
  cardDescKey?: string;
}

const STOCK_TAB_DEFINITIONS: Record<StockTabId, StockTabDefinition> = {
  status: {
    id: 'status',
    labelKey: 'stock.tabs.status',
    cardDescKey: 'stock.status.cardDesc',
  },
  warehouses: {
    id: 'warehouses',
    labelKey: 'stock.tabs.warehouses',
    cardDescKey: 'stock.warehouses.cardDesc',
  },
  movements: {
    id: 'movements',
    labelKey: 'stock.tabs.movements',
  },
  transfers: {
    id: 'transfers',
    labelKey: 'stock.tabs.transfers',
    cardDescKey: 'stock.transfers.cardDesc',
  },
  forecast: {
    id: 'forecast',
    labelKey: 'stock.tabs.forecast',
    cardDescKey: 'stock.forecast.cardDesc',
  },
};

export const STOCK_TABS: StockTabDefinition[] = STOCK_TAB_IDS.map(
  (id) => STOCK_TAB_DEFINITIONS[id],
);

export function isStockTabId(value: string | null): value is StockTabId {
  return value !== null && STOCK_TAB_IDS.includes(value as StockTabId);
}

export function defaultStockTab(): StockTabId {
  return 'status';
}

export function getStockTabDefinition(id: StockTabId): StockTabDefinition {
  return STOCK_TAB_DEFINITIONS[id];
}

function stockNavContext(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): NavCatalogContext {
  return { orgProducts, accountingMode };
}

/** Stok menüsü Ön Muhasebe grubundaysa yerel envanter alt metni */
export function resolveStockSubtitleKey(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): string {
  const ctx = stockNavContext(orgProducts, accountingMode);
  if (shouldPlaceStockInNativeAccounting(ctx)) {
    return 'stock.subtitle.nativeAccounting';
  }
  if (shouldPlaceStockInEcommerce(ctx)) {
    return 'stock.subtitle.ecommerce';
  }
  return 'stock.subtitle.nativeAccounting';
}
