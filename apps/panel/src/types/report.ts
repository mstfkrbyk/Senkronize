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
  platforms?: string[];
  groupBy?: 'day' | 'week' | 'month';
}

export interface SalesDetailRow {
  period: string;
  platform: string;
  orders: number;
  revenue: number;
  returns: number;
  netRevenue: number;
}

export interface ProfitPlatformRow {
  platform: string;
  revenue: number;
  shippingCost: number;
  vatAmount: number;
  productCost: number;
  profit: number;
  marginPct: number;
}

export interface ReportScheduleItem {
  id: string;
  reportKind: 'SALES' | 'STOCK' | 'PROFIT';
  frequency: 'WEEKLY' | 'MONTHLY';
  emails: string[];
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReportScheduleType = 'SALES' | 'VAT' | 'PROFIT' | 'CUSTOM';

export type ReportScheduleFrequencyUi = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type ReportScheduleFormat = 'PDF' | 'EXCEL';

export interface UnifiedReportSchedule {
  id: string;
  source: 'standard' | 'custom';
  reportType: ReportScheduleType;
  frequency: ReportScheduleFrequencyUi;
  format: ReportScheduleFormat;
  emails: string[];
  lastRunAt: string | null;
  isActive: boolean;
  name?: string;
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
  totalRevenueTry: number;
  totalRevenue: number;
  revenueByOriginalCurrency: {
    currency: string;
    totalOriginal: number;
    orderCount: number;
  }[];
  ordersWithApproximateTryConversion: number;
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
