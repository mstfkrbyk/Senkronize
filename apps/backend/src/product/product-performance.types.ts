import type { Marketplace } from '@prisma/client';

export interface ProductPerformancePlatformSlice {
  platform: Marketplace;
  sales: number;
  revenue: number;
  avgRating?: number;
}

export interface ProductStockForecast {
  stockoutDate: string | null;
  reorderSuggested: boolean;
}

export interface ProductPerformanceResponse {
  productId: string;
  period: string;
  totalSales: number;
  totalRevenue: number;
  platforms: ProductPerformancePlatformSlice[];
  stockTurnoverRate: number;
  daysOfStock: number;
  stockForecast: ProductStockForecast;
}
