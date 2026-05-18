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
