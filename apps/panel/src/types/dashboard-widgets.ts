export type WidgetType =
  | 'kpi-orders'
  | 'kpi-revenue'
  | 'kpi-products'
  | 'kpi-stock-alerts'
  | 'chart-sales'
  | 'chart-platforms'
  | 'table-orders'
  | 'table-stock'
  | 'kpi-listings'
  | 'kpi-buybox'
  | 'revenue-chart'
  | 'platform-breakdown'
  | 'stock-alerts'
  | 'sync-status'
  | 'top-products'
  | 'recent-orders'
  | 'buybox-rate'
  | 'orders-summary';

export type WidgetSize = '1x1' | '2x1' | '2x2';

export interface Widget {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  position: number;
  visible?: boolean;
}

export const DEFAULT_WIDGETS: Widget[] = [
  { id: 'w-kpi-revenue', type: 'kpi-revenue', size: '1x1', position: 0, visible: true },
  { id: 'w-kpi-orders', type: 'kpi-orders', size: '1x1', position: 1, visible: true },
  { id: 'w-kpi-products', type: 'kpi-products', size: '1x1', position: 2, visible: true },
  { id: 'w-kpi-stock', type: 'kpi-stock-alerts', size: '1x1', position: 3, visible: true },
  { id: 'w-chart-sales', type: 'chart-sales', size: '2x1', position: 4, visible: true },
  { id: 'w-table-orders', type: 'table-orders', size: '1x1', position: 5, visible: true },
  { id: 'w-chart-platforms', type: 'chart-platforms', size: '1x1', position: 6, visible: true },
  { id: 'w-table-stock', type: 'table-stock', size: '1x1', position: 7, visible: true },
  { id: 'w-top', type: 'top-products', size: '2x1', position: 8, visible: false },
  { id: 'w-sync', type: 'sync-status', size: '1x1', position: 9, visible: false },
  { id: 'w-buybox', type: 'buybox-rate', size: '1x1', position: 10, visible: false },
];

export const WIDGET_STORAGE_KEY = 'senkronize-dashboard-widgets';

const LEGACY_WIDGET_TYPE_MAP: Record<string, WidgetType> = {
  chart_revenue: 'chart-sales',
  chart_orders: 'orders-summary',
  chart_platform: 'chart-platforms',
  chart_sales: 'chart-sales',
  chart_platforms: 'chart-platforms',
  table_low_stock: 'table-stock',
  table_orders: 'table-orders',
  table_stock: 'table-stock',
  sync_status: 'sync-status',
  table_recent_orders: 'table-orders',
  kpi_buybox_rate: 'kpi-buybox',
  kpi_orders: 'kpi-orders',
  kpi_revenue: 'kpi-revenue',
  kpi_stock_alerts: 'kpi-stock-alerts',
  kpi_products: 'kpi-products',
  kpi_listings: 'kpi-products',
  forecast_critical: 'table-stock',
  activity_feed: 'table-orders',
  'orders-summary': 'kpi-orders',
  'revenue-chart': 'chart-sales',
  'platform-breakdown': 'chart-platforms',
  'recent-orders': 'table-orders',
  'stock-alerts': 'table-stock',
  'kpi-listings': 'kpi-products',
};

const KPI_LEGACY_TYPES = new Set([
  'kpi_orders',
  'kpi_revenue',
  'kpi_stock_alerts',
  'kpi_buybox_rate',
  'kpi_listings',
]);

function normalizeWidget(raw: unknown): Widget | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  let type = typeof row.type === 'string' ? row.type : '';
  if (KPI_LEGACY_TYPES.has(type) && type in LEGACY_WIDGET_TYPE_MAP) {
    type = LEGACY_WIDGET_TYPE_MAP[type] ?? type;
  }
  if (type in LEGACY_WIDGET_TYPE_MAP) {
    type = LEGACY_WIDGET_TYPE_MAP[type] ?? type;
  }
  const validTypes: WidgetType[] = [
    'kpi-revenue',
    'kpi-orders',
    'kpi-products',
    'kpi-stock-alerts',
    'chart-sales',
    'chart-platforms',
    'table-orders',
    'table-stock',
    'kpi-listings',
    'kpi-buybox',
    'revenue-chart',
    'orders-summary',
    'platform-breakdown',
    'stock-alerts',
    'sync-status',
    'top-products',
    'recent-orders',
    'buybox-rate',
  ];
  if (!validTypes.includes(type as WidgetType)) {
    return null;
  }
  const size =
    row.size === '2x1' || row.size === '2x2' || row.size === '1x1' ? row.size : '1x1';
  const id = typeof row.id === 'string' ? row.id : `w-${type}`;
  const position = typeof row.position === 'number' ? row.position : 0;
  const visible = typeof row.visible === 'boolean' ? row.visible : true;
  return {
    id,
    type: type as WidgetType,
    size,
    position,
    visible,
  };
}

export function parseStoredWidgets(raw: unknown): Widget[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_WIDGETS;
  }
  const parsed = raw
    .map(normalizeWidget)
    .filter((w): w is Widget => w !== null);
  if (parsed.length === 0) {
    return DEFAULT_WIDGETS;
  }
  const seen = new Set<WidgetType>();
  const deduped: Widget[] = [];
  for (const w of parsed.sort((a, b) => a.position - b.position)) {
    if (seen.has(w.type)) {
      continue;
    }
    seen.add(w.type);
    deduped.push({ ...w, position: deduped.length });
  }
  return deduped;
}

export interface KpiMetricBlock {
  current: number;
  previous: number;
  change: number;
}

export interface DashboardKpisResponse {
  revenue: KpiMetricBlock;
  orders: KpiMetricBlock;
  avgOrderValue: KpiMetricBlock;
  activeListings: KpiMetricBlock;
  lowStockProducts: number;
  pendingOrders: number;
  buyboxWinRate: number;
}

export interface DashboardApiSummary {
  todayOrders: number;
  todayOrdersDelta: number;
  windowOrders: number;
  windowOrdersDeltaPct: number;
  revenueTry: number;
  revenueDeltaPct: number;
  lowStockCount: number;
  buyboxWinRatePct: number;
  buyboxWinRateDeltaPct: number;
  pendingOrders: number;
  totalConnections: number;
  activeConnections: number;
}

export interface DashboardKpiUpdatePayload {
  period: string;
  kpis: DashboardKpisResponse;
  emittedAt: string;
}

export interface DashboardOrderNewPayload {
  orderId: string;
  platform: string;
  amount: string;
  customer: string;
}

export interface DashboardStockAlertPayload {
  barcode: string;
  title: string;
  quantity: number;
  threshold: number;
}

export interface DashboardOrdersTrendPoint {
  date: string;
  label: string;
  orderCount: number;
  revenue: number;
}

export interface DashboardPlatformSlice {
  platform: string;
  label: string;
  orderCount: number;
  revenue: number;
}

export interface DashboardActivityItem {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

export interface DashboardTopProductRow {
  productId: string | null;
  name: string;
  sku: string | null;
  sales: number;
  revenue: number;
  platforms: string[];
}
