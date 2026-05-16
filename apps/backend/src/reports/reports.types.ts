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
