export type WidgetType =
  | 'revenue-chart'
  | 'orders-summary'
  | 'platform-breakdown'
  | 'stock-alerts'
  | 'sync-status'
  | 'top-products'
  | 'recent-orders'
  | 'buybox-rate';

export type WidgetSize = '1x1' | '2x1' | '2x2';

export interface Widget {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  position: number;
}

export const DEFAULT_WIDGETS: Widget[] = [
  { id: 'w-revenue', type: 'revenue-chart', size: '2x1', position: 0 },
  { id: 'w-orders', type: 'orders-summary', size: '2x1', position: 1 },
  { id: 'w-platform', type: 'platform-breakdown', size: '1x1', position: 2 },
  { id: 'w-sync', type: 'sync-status', size: '1x1', position: 3 },
  { id: 'w-recent', type: 'recent-orders', size: '2x1', position: 4 },
  { id: 'w-stock', type: 'stock-alerts', size: '1x1', position: 5 },
  { id: 'w-top', type: 'top-products', size: '2x1', position: 6 },
];

export const WIDGET_STORAGE_KEY = 'senkronize-dashboard-widgets';

/** Eski localStorage düzenlerini yeni widget tiplerine dönüştürür. */
const LEGACY_WIDGET_TYPE_MAP: Record<string, WidgetType> = {
  chart_revenue: 'revenue-chart',
  chart_orders: 'orders-summary',
  chart_platform: 'platform-breakdown',
  table_low_stock: 'stock-alerts',
  sync_status: 'sync-status',
  table_recent_orders: 'recent-orders',
  kpi_buybox_rate: 'buybox-rate',
  forecast_critical: 'stock-alerts',
  activity_feed: 'recent-orders',
};

const KPI_WIDGET_TYPES = new Set([
  'kpi_orders',
  'kpi_revenue',
  'kpi_stock_alerts',
  'kpi_buybox_rate',
]);

function normalizeWidget(raw: unknown): Widget | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  let type = typeof row.type === 'string' ? row.type : '';
  if (KPI_WIDGET_TYPES.has(type)) {
    return null;
  }
  if (type in LEGACY_WIDGET_TYPE_MAP) {
    type = LEGACY_WIDGET_TYPE_MAP[type] ?? type;
  }
  const validTypes: WidgetType[] = [
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
  return {
    id,
    type: type as WidgetType,
    size,
    position,
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
