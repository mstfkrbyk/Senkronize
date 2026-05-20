export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ProductListItem {
  id: string;
  organizationId: string;
  barcode: string;
  sku: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  categoryId?: string | null;
  costPrice: unknown;
  salePrice?: unknown;
  reorderPoint?: number | null;
  reorderQty?: number | null;
  leadTimeDays?: number | null;
  tags: string[];
  imageUrls: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  imageCount?: number;
  totalStock?: number;
  _count?: {
    variants: number;
    listings: number;
  };
}

export interface ProductVariantDto {
  id: string;
  organizationId: string;
  productId: string;
  sku: string;
  barcode: string | null;
  title: string;
  attributes: unknown;
  price: unknown;
  costPrice: unknown;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetailListing {
  id: string;
  platform: string;
  title: string;
  salePrice: unknown;
  listPrice: unknown;
  quantity: number;
  approved: boolean;
  lastSyncAt: string | null;
}

export interface ProductDetailStock {
  id: string;
  barcode: string;
  platform: string | null;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  reservedQty: number;
  updatedAt: string;
}

export interface BulkPriceUpdateForm {
  updateType: 'fixed' | 'percentage' | 'set';
  value: number;
  direction: 'increase' | 'decrease';
  applyToField: 'salePrice' | 'listPrice' | 'both';
  previewCount: number;
}

export type ProductExportColumn =
  | 'barcode'
  | 'sku'
  | 'name'
  | 'category'
  | 'salePrice'
  | 'listPrice'
  | 'stock'
  | 'description'
  | 'brand'
  | 'costPrice';

export interface ProductAnalyticsResponse {
  days: number;
  dailySales: { date: string; quantity: number; revenue: number }[];
  kpis: {
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
  };
  platformDistribution: {
    platform: string;
    quantity: number;
    revenue: number;
    orderCount: number;
    returnRatePct: number;
    weekOrderCount: number;
    monthOrderCount: number;
  }[];
  priceHistory: { date: string; price: number; platform: string }[];
}

export interface StockForecastDataPoint {
  date: string;
  actual?: number;
  forecast?: number;
  reorderPoint: number;
}

export interface ProductStockForecastResult {
  productId: string;
  barcode: string;
  currentStock: number;
  dailySalesAvg: number;
  dailySales: number;
  reorderPoint: number;
  forecastDays: number;
  daysUntilStockout: number | null;
  daysUntilReorderPoint: number | null;
  forecastData: StockForecastDataPoint[];
}

export interface ImportPreviewRow {
  row: Record<string, string>;
  lineNumber: number;
  valid: boolean;
  errors: string[];
}

export interface ProductDetailPayload {
  product: {
    id: string;
    organizationId: string;
    barcode: string;
    sku: string | null;
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    costPrice: unknown;
    tags: string[];
    imageUrls: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  variants: ProductVariantDto[];
  listings: ProductDetailListing[];
  stockMovements: ProductDetailStock[];
}
