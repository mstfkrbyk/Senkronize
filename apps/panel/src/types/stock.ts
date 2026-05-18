export interface StockEntry {
  id: string;
  organizationId?: string;
  barcode: string;
  platform: string | null;
  warehouseId?: string;
  warehouseCode?: string;
  warehouseName?: string;
  quantity: number;
  reservedQty: number;
  availableQty: number;
  product: {
    id: string;
    name: string;
    sku: string | null;
  } | null;
  updatedAt: string;
  createdAt?: string;
}

export interface StockListResponse {
  items: StockEntry[];
  total: number;
}

export interface StockFilters {
  search?: string;
  platform?: string;
  warehouseId?: string;
  lowStock?: boolean;
  page?: number;
  limit?: number;
}

export interface StockOverviewRow {
  barcode: string;
  productName: string | null;
  sku: string | null;
  totalQuantity: number;
  totalReserved: number;
  available: number;
  lowStock: boolean;
  byPlatform: { platform: string | null; quantity: number }[];
  byWarehouse: {
    warehouseId: string;
    code: string;
    name: string;
    quantity: number;
    reservedQty: number;
  }[];
}

export interface WarehouseDto {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovementDto {
  id: string;
  organizationId: string;
  barcode: string;
  warehouseId: string | null;
  platform: string | null;
  movementType: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  orderId: string | null;
  note: string | null;
  createdAt: string;
}
