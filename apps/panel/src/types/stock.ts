export interface StockEntry {
  id: string;
  barcode: string;
  platform: string | null;
  quantity: number;
  reservedQty: number;
  availableQty: number;
  product: {
    id: string;
    name: string;
    sku: string | null;
  } | null;
  updatedAt: string;
}

export interface StockListResponse {
  items: StockEntry[];
  total: number;
}

export interface StockFilters {
  search?: string;
  platform?: string;
  lowStock?: boolean;
  page?: number;
  limit?: number;
}
