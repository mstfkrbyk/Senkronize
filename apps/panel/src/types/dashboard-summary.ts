export interface DashboardSummaryDto {
  todayOrders: number;
  todayOrdersDelta: number;
  pendingOrders: number;
  totalProducts: number;
  activeConnections: number;
  totalConnections: number;
  lowStockCount: number;
  windowOrders: number;
  windowOrdersPrev: number;
  windowOrdersDeltaPct: number;
}
