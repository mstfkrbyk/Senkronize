export interface ProfitByPlatformRow {
  platform: string;
  grossRevenue: number;
  commissionPercent: number;
  commissionAmount: number;
  netRevenue: number;
  orderCount: number;
  grossProfit: number;
  profitMargin: number;
}

export interface ProfitByProductRow {
  productId: string | null;
  barcode: string;
  name: string;
  quantitySold: number;
  revenue: number;
  costTotal: number;
  grossProfit: number;
  profitMargin: number;
}

export interface ProfitByCategoryRow {
  category: string;
  quantitySold: number;
  revenue: number;
  costTotal: number;
  grossProfit: number;
  profitMargin: number;
}

export interface ProfitBreakdownReportDto {
  period: { from: string; to: string; label: string };
  rows: ProfitByPlatformRow[] | ProfitByProductRow[] | ProfitByCategoryRow[];
}
