export type WidgetType =
  | 'kpi_orders'
  | 'kpi_revenue'
  | 'kpi_stock_alerts'
  | 'kpi_buybox_rate'
  | 'chart_orders'
  | 'chart_revenue'
  | 'chart_platform'
  | 'table_recent_orders'
  | 'table_low_stock'
  | 'activity_feed'
  | 'sync_status'
  | 'forecast_critical';

export type WidgetSize = '1x1' | '2x1' | '2x2';

export interface Widget {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  position: number;
}

export const DEFAULT_WIDGETS: Widget[] = [
  { id: 'w1', type: 'kpi_orders', size: '1x1', position: 0 },
  { id: 'w2', type: 'kpi_revenue', size: '1x1', position: 1 },
  { id: 'w3', type: 'kpi_stock_alerts', size: '1x1', position: 2 },
  { id: 'w4', type: 'kpi_buybox_rate', size: '1x1', position: 3 },
  { id: 'w5', type: 'chart_orders', size: '2x1', position: 4 },
  { id: 'w6', type: 'table_recent_orders', size: '2x1', position: 5 },
  { id: 'w7', type: 'sync_status', size: '1x1', position: 6 },
  { id: 'w8', type: 'table_low_stock', size: '1x1', position: 7 },
];

export const WIDGET_STORAGE_KEY = 'senkronize-dashboard-widgets';

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
