export interface ProductAnalyticsDailySale {
  date: string;
  quantity: number;
  revenue: number;
}

export interface ProductAnalyticsKpis {
  totalSales: number;
  totalRevenue: number;
  averageDailySales: number;
  bestDay: { date: string; quantity: number } | null;
}

export interface ProductAnalyticsPlatformSlice {
  platform: string;
  quantity: number;
  revenue: number;
}

export interface ProductAnalyticsPricePoint {
  date: string;
  price: number;
  platform: string;
}

export interface ProductAnalyticsResponse {
  days: number;
  dailySales: ProductAnalyticsDailySale[];
  kpis: ProductAnalyticsKpis;
  platformDistribution: ProductAnalyticsPlatformSlice[];
  priceHistory: ProductAnalyticsPricePoint[];
}
