export interface PlatformComparisonRow {
  platform: string;
  label: string;
  orderCount: number;
  revenue: number;
  avgBasket: number;
  returnRate: number;
  buyBoxWinRate: number;
  growthPct: number;
}

export interface PlatformComparisonResponse {
  periodDays: number;
  platforms: PlatformComparisonRow[];
}

export interface CityInsightRow {
  city: string;
  orderCount: number;
  revenue: number;
}

export interface CustomerInsightsResponse {
  periodDays: number;
  repeatCustomerRate: number;
  avgOrderValue: number;
  totalCustomers: number;
  repeatCustomers: number;
  topCities: CityInsightRow[];
}

export interface HourlyRevenueRow {
  hour: number;
  label: string;
  revenue: number;
  orderCount: number;
}

export interface RevenueByHourResponse {
  days: number;
  hours: HourlyRevenueRow[];
}

export interface TopProductRow {
  barcode: string;
  productName: string | null;
  quantity: number;
  revenue: number;
  orderCount: number;
}

export interface TopProductsResponse {
  periodDays: number;
  products: TopProductRow[];
}

export interface TopReturnedProductRow {
  barcode: string;
  returnCount: number;
  quantity: number;
}

export interface TopReturnedProductsResponse {
  periodDays: number;
  products: TopReturnedProductRow[];
}

export interface AovTrendPoint {
  date: string;
  label: string;
  aov: number;
  orderCount: number;
  revenue: number;
}

export interface AovTrendResponse {
  days: number;
  points: AovTrendPoint[];
}

export interface DailyRevenuePoint {
  date: string;
  label: string;
  revenue: number;
  orderCount: number;
}

export interface DailyRevenueTrendResponse {
  days: number;
  points: DailyRevenuePoint[];
}
