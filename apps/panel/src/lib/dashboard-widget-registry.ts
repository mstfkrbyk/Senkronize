import {
  hasOrgProductLine,
  isAccountingOnlyOrg,
  isBundleOrg,
  resolveStockRouteProductLine,
} from '@/lib/org-products';
import type { AccountingMode, OrgProductLine } from '@/types/auth';
import type { Widget, WidgetType } from '@/types/dashboard-widgets';
import {
  DEFAULT_ACCOUNTING_WIDGETS,
  DEFAULT_WIDGETS,
} from '@/types/dashboard-widgets';

/** Widget'ın hangi ürün hatlarında gösterilebileceği (stok tipleri dinamik çözülür). */
export const WIDGET_PRODUCT_LINES: Record<
  Exclude<WidgetType, StockWidgetType>,
  readonly OrgProductLine[]
> = {
  'kpi-revenue': ['INTEGRATION'],
  'kpi-orders': ['INTEGRATION'],
  'kpi-products': ['INTEGRATION'],
  'chart-sales': ['INTEGRATION'],
  'chart-platforms': ['INTEGRATION'],
  'table-orders': ['INTEGRATION'],
  'kpi-listings': ['INTEGRATION'],
  'kpi-buybox': ['INTEGRATION'],
  'revenue-chart': ['INTEGRATION'],
  'orders-summary': ['INTEGRATION'],
  'platform-breakdown': ['INTEGRATION'],
  'sync-status': ['INTEGRATION'],
  'top-products': ['INTEGRATION'],
  'recent-orders': ['INTEGRATION'],
  'buybox-rate': ['INTEGRATION'],
  'accounting-kpi': ['ACCOUNTING'],
  'accounting-recent-invoices': ['ACCOUNTING'],
};

type StockWidgetType = 'kpi-stock-alerts' | 'table-stock' | 'stock-alerts';

const STOCK_WIDGET_TYPES = new Set<WidgetType>([
  'kpi-stock-alerts',
  'table-stock',
  'stock-alerts',
]);

const ACCOUNTING_WIDGET_TYPES = new Set<WidgetType>([
  'accounting-kpi',
  'accounting-recent-invoices',
]);

/** Widget özelleştirici ve ekleme diyalogunda ürün hattı alt metni. */
export const WIDGET_PRODUCT_LINE_HINTS: Record<OrgProductLine, string> = {
  INTEGRATION: 'Entegrasyon',
  ACCOUNTING: 'Ön muhasebe',
};

const BUNDLE_OPTIONAL_ACCOUNTING_WIDGETS: Widget[] = [
  {
    id: 'w-accounting-kpi',
    type: 'accounting-kpi',
    size: '2x1',
    position: 11,
    visible: false,
  },
  {
    id: 'w-accounting-recent',
    type: 'accounting-recent-invoices',
    size: '2x1',
    position: 12,
    visible: false,
  },
];

const INTEGRATION_CHART_ROW: WidgetType[] = ['chart-sales', 'table-orders'];
const INTEGRATION_BOTTOM_ROW: WidgetType[] = ['chart-platforms', 'table-stock'];
const ACCOUNTING_LAYOUT: WidgetType[] = ['accounting-kpi', 'accounting-recent-invoices'];
const BUNDLE_OPTIONAL_ACCOUNTING_TYPES: WidgetType[] = [
  'accounting-kpi',
  'accounting-recent-invoices',
];

function isStockWidgetType(type: WidgetType): type is StockWidgetType {
  return STOCK_WIDGET_TYPES.has(type);
}

function resolveWidgetProductLines(
  type: WidgetType,
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): readonly OrgProductLine[] {
  if (isStockWidgetType(type)) {
    return [resolveStockRouteProductLine(orgProducts, accountingMode)];
  }
  return WIDGET_PRODUCT_LINES[type];
}

/** BUNDLE muhasebe widget'ları ve NATIVE stok widget'ları için alt açıklama. */
export function getWidgetCustomizerHint(
  type: WidgetType,
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode = 'NATIVE',
): string | undefined {
  if (isBundleOrg(orgProducts) && ACCOUNTING_WIDGET_TYPES.has(type)) {
    return WIDGET_PRODUCT_LINE_HINTS.ACCOUNTING;
  }
  if (isStockWidgetType(type)) {
    const line = resolveStockRouteProductLine(orgProducts, accountingMode);
    if (line === 'ACCOUNTING') {
      return WIDGET_PRODUCT_LINE_HINTS.ACCOUNTING;
    }
  }
  return undefined;
}

export function isWidgetAllowedForOrg(
  type: WidgetType,
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode = 'NATIVE',
): boolean {
  const lines = resolveWidgetProductLines(type, orgProducts, accountingMode);
  return lines.some((line) => hasOrgProductLine(orgProducts, line));
}

export function filterWidgetTypes(
  types: WidgetType[],
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode = 'NATIVE',
): WidgetType[] {
  return types.filter((type) => isWidgetAllowedForOrg(type, orgProducts, accountingMode));
}

export function filterWidgets(
  widgets: Widget[],
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode = 'NATIVE',
): Widget[] {
  return widgets.filter((w) =>
    isWidgetAllowedForOrg(w.type, orgProducts, accountingMode),
  );
}

export function getAllowedWidgetTypes(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode = 'NATIVE',
): WidgetType[] {
  const allTypes = [
    ...Object.keys(WIDGET_PRODUCT_LINES),
    ...STOCK_WIDGET_TYPES,
  ] as WidgetType[];
  return allTypes.filter((type) =>
    isWidgetAllowedForOrg(type, orgProducts, accountingMode),
  );
}

export function getDefaultWidgetsForOrg(
  orgProducts: OrgProductLine[] | undefined,
): Widget[] {
  if (isAccountingOnlyOrg(orgProducts)) {
    return DEFAULT_ACCOUNTING_WIDGETS;
  }
  if (isBundleOrg(orgProducts)) {
    return [...DEFAULT_WIDGETS, ...BUNDLE_OPTIONAL_ACCOUNTING_WIDGETS];
  }
  return DEFAULT_WIDGETS;
}

function integrationBottomRow(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): WidgetType[] {
  if (isBundleOrg(orgProducts) && accountingMode === 'NATIVE') {
    return ['chart-platforms'];
  }
  return [...INTEGRATION_BOTTOM_ROW];
}

function bundleAccountingRow(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): WidgetType[] {
  if (!isBundleOrg(orgProducts)) {
    return [];
  }
  if (accountingMode === 'NATIVE') {
    return ['table-stock'];
  }
  return [];
}

export function getDefaultLayoutForOrg(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode = 'NATIVE',
): WidgetType[] {
  if (isAccountingOnlyOrg(orgProducts)) {
    return [...ACCOUNTING_LAYOUT];
  }
  return [
    ...INTEGRATION_CHART_ROW,
    ...integrationBottomRow(orgProducts, accountingMode),
    ...bundleAccountingRow(orgProducts, accountingMode),
  ];
}

export function getLayoutSectionsForOrg(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode = 'NATIVE',
): {
  primary: WidgetType[];
  secondary: WidgetType[];
  accounting: WidgetType[];
} {
  if (isAccountingOnlyOrg(orgProducts)) {
    return {
      primary: ['accounting-kpi'],
      secondary: ['accounting-recent-invoices'],
      accounting: [],
    };
  }
  return {
    primary: [...INTEGRATION_CHART_ROW],
    secondary: integrationBottomRow(orgProducts, accountingMode),
    accounting: bundleAccountingRow(orgProducts, accountingMode),
  };
}

/** BUNDLE: özelleştirmede açılan muhasebe widget'larını layout'a ekler. */
export function appendBundleOptionalWidgets(
  layout: WidgetType[],
  orgProducts: OrgProductLine[] | undefined,
  isVisible: (type: WidgetType) => boolean,
): WidgetType[] {
  if (!isBundleOrg(orgProducts)) {
    return layout;
  }
  const extras = BUNDLE_OPTIONAL_ACCOUNTING_TYPES.filter(
    (type) => isVisible(type) && !layout.includes(type),
  );
  return extras.length > 0 ? [...layout, ...extras] : layout;
}

export function mergeLayoutOrder(
  stored: WidgetType[],
  defaults: WidgetType[],
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode = 'NATIVE',
): WidgetType[] {
  const allowedDefaults = filterWidgetTypes(defaults, orgProducts, accountingMode);
  const ordered = filterWidgetTypes(
    stored.filter((type) => allowedDefaults.includes(type)),
    orgProducts,
    accountingMode,
  );
  for (const type of allowedDefaults) {
    if (!ordered.includes(type)) {
      ordered.push(type);
    }
  }
  return ordered;
}
