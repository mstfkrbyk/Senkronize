export interface SalesReportData {
  period: string;
  totalOrders: number;
  totalRevenue: number;
  byPlatform: Record<string, number>;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  platform?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export interface PlatformReportData {
  platform: string;
  totalOrders: number;
  totalRevenue: number;
  percentage: number;
}

export interface TopProduct {
  barcode: string;
  totalQuantity: number;
  orderCount: number;
}
