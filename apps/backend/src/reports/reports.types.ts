export interface SalesReportRow {
  period: string;
  totalOrders: number;
  totalRevenue: number;
  byPlatform: Record<string, number>;
}

export interface PlatformReportRow {
  platform: string;
  orderCount: number;
  revenue: number;
}

export interface TopProductRow {
  barcode: string;
  totalQuantity: number;
  orderCount: number;
}

export interface StockMovementRow {
  barcode: string;
  platform: string | null;
  quantity: number;
  reservedQty: number;
  updatedAt: string;
}

export interface DashboardSummaryDto {
  todayOrders: number;
  todayOrdersDelta: number;
  pendingOrders: number;
  totalProducts: number;
  activeConnections: number;
  totalConnections: number;
  lowStockCount: number;
  /** Seçilen zaman penceresindeki sipariş adedi (panel dönem filtresi). */
  windowOrders: number;
  /** Bir önceki eşit uzunluktaki penceredeki sipariş adedi. */
  windowOrdersPrev: number;
  /** Önceki pencereye göre yüzde fark (yaklaşık). */
  windowOrdersDeltaPct: number;
  /** Takvim ayı başından bugüne kadar oluşturulan iade talepleri. */
  returnsThisMonth: number;
  /** Aynı dönemdeki siparişlere göre iade oranı (%). */
  returnRatePct: number;
}

export interface ProfitReportByPlatformRow {
  platform: string;
  /** TRY (kur dönüşümü sonrası) */
  revenue: number;
  orderCount: number;
}

export interface ProfitReportTopProductRow {
  name: string;
  barcode: string;
  /** Tahmini satır cirosu TRY */
  revenue: number;
  quantity: number;
}

export interface ProfitReportOriginalCurrencyRow {
  currency: string;
  /** Orijinal para biriminde sipariş tutarları toplamı */
  totalOriginal: number;
  orderCount: number;
}

export interface ProfitReportDto {
  /** Sipariş tarihindeki kurlarla TRY toplamı */
  totalRevenueTry: number;
  /** Geriye dönük uyumluluk: `totalRevenueTry` ile aynı */
  totalRevenue: number;
  revenueByOriginalCurrency: ProfitReportOriginalCurrencyRow[];
  /** Kur bulunamadığı için ham tutarın TRY kabul edildiği sipariş sayısı */
  ordersWithApproximateTryConversion: number;
  estimatedProfit: number;
  profitMargin: number;
  byPlatform: ProfitReportByPlatformRow[];
  topProducts: ProfitReportTopProductRow[];
}

export interface StockValueByPlatformRow {
  platform: string;
  totalValue: number;
  skuCount: number;
}

export interface StockValueReportDto {
  totalProducts: number;
  totalSkus: number;
  totalStockValue: number;
  outOfStockCount: number;
  lowStockCount: number;
  byPlatform: StockValueByPlatformRow[];
}

export interface OrderTrendDto {
  labels: string[];
  orderCounts: number[];
  revenues: number[];
}

export interface PlatformComparisonRowDto {
  name: string;
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
  returnRate: number;
  syncStatus: string;
}

export interface PlatformComparisonDto {
  platforms: PlatformComparisonRowDto[];
}
