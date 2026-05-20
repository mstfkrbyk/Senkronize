export interface StockoutEstimateDto {
  productId: string;
  barcode: string;
  name: string;
  sku: string | null;
  currentStock: number;
  dailyVelocity: number;
  daysUntilStockout: number | null;
  estimatedStockoutDate: string | null;
  recommendedOrderQty: number;
  reorderPoint: number | null;
  reorderQty: number | null;
  leadTimeDays: number | null;
  belowReorder: boolean;
  /** Maliyet tahmini için birim maliyet (TRY); yoksa null */
  unitCostTry: number | null;
}

export interface StockForecastSummaryDto {
  countWithin7Days: number;
  countWithin14Days: number;
  countWithin30Days: number;
  estimatedRestockCostThisMonthTry: number;
}

export interface SeasonalityDataDto {
  barcode: string;
  recentVelocity: number;
  priorVelocity: number;
  seasonalityIndex: number;
  trendLabel: 'yükseliş' | 'düşüş' | 'stabil';
}

export interface StockProjectionPointDto {
  dayOffset: number;
  date: string;
  projectedStock: number;
}

export interface StockProjectionDto {
  barcode: string;
  currentStock: number;
  dailyVelocity: number;
  reorderPoint: number | null;
  points: StockProjectionPointDto[];
}

export interface StockForecastDataPointDto {
  date: string;
  actual?: number;
  forecast?: number;
  reorderPoint: number;
}

export interface ProductStockForecastResultDto {
  productId: string;
  barcode: string;
  currentStock: number;
  dailySalesAvg: number;
  dailySales: number;
  reorderPoint: number;
  forecastDays: number;
  daysUntilStockout: number | null;
  daysUntilReorderPoint: number | null;
  forecastData: StockForecastDataPointDto[];
}
