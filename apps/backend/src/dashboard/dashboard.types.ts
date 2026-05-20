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
