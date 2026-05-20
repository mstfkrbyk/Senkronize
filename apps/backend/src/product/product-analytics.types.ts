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
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueChangePct: number | null;
  averageOrderValue: number;
  returnRatePct: number;
  orderCount: number;
}

export interface ProductAnalyticsPlatformSlice {
  platform: string;
  quantity: number;
  revenue: number;
  orderCount: number;
  returnRatePct: number;
  weekOrderCount: number;
  monthOrderCount: number;
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
