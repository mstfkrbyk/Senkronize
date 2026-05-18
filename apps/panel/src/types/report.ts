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

export interface ProfitReportData {
  totalRevenue: number;
  estimatedProfit: number;
  profitMargin: number;
  byPlatform: { platform: string; revenue: number; orderCount: number }[];
  topProducts: { name: string; barcode: string; revenue: number; quantity: number }[];
}

export interface StockValueReportData {
  totalProducts: number;
  totalSkus: number;
  totalStockValue: number;
  outOfStockCount: number;
  lowStockCount: number;
  byPlatform: { platform: string; totalValue: number; skuCount: number }[];
}

export interface OrderTrendData {
  labels: string[];
  orderCounts: number[];
  revenues: number[];
}

export interface PlatformComparisonRow {
  name: string;
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
  returnRate: number;
  syncStatus: string;
}

export interface PlatformComparisonData {
  platforms: PlatformComparisonRow[];
}
