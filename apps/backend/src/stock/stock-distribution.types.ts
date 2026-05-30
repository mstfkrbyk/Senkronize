export type StockDistributionStrategy = 'EQUAL' | 'PROPORTIONAL' | 'PRIORITY';

export interface DistributionResult {
  distribution: Record<string, number>;
  pushedAt: string;
  jobIds: string[];
}

export interface DistributionPreview {
  barcode: string;
  totalStock: number;
  byPlatform: Record<string, number>;
}

export interface ErpStockSourceRow {
  erpConnectionId: string;
  erpType: string;
  displayName: string | null;
  role: 'PRIMARY' | 'SECONDARY';
  quantity: number;
  warehouseCode: string;
  warehouseName: string;
  updatedAt: string;
}

export interface ErpStockBreakdown {
  barcode: string;
  mergedTotal: number;
  sources: ErpStockSourceRow[];
}
