export interface DashboardSummaryResponse {
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

export interface DashboardOrdersTrendResponse {
  days: number;
  points: DashboardOrdersTrendPoint[];
}

export interface DashboardPlatformSlice {
  platform: string;
  label: string;
  orderCount: number;
  revenue: number;
}

export interface DashboardPlatformDistributionResponse {
  slices: DashboardPlatformSlice[];
}

export interface DashboardActivityItem {
  id: string;
  action: string;
  description: string;
  createdAt: string;
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

export interface DashboardPlatformPerformanceRow {
  platform: string;
  orders: number;
  revenue: number;
  share: number;
}

export interface DashboardRevenueTrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface DashboardTopProductRow {
  productId: string | null;
  name: string;
  sku: string | null;
  sales: number;
  revenue: number;
  platforms: string[];
}

export type DashboardActivityKind = 'order' | 'stock_alert' | 'sync';

export interface DashboardActivityFeedItem {
  id: string;
  kind: DashboardActivityKind;
  title: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export type DashboardWidgetSize = '1x1' | '2x1' | '2x2';

export interface DashboardWidgetConfig {
  id: string;
  type: string;
  size: DashboardWidgetSize;
  position: number;
  visible?: boolean;
}

export interface DashboardWidgetsResponse {
  widgets: DashboardWidgetConfig[];
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
