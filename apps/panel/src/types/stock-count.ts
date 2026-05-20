export type StockCountModeApi = 'FULL' | 'PARTIAL';

export type StockCountSessionStatusApi =
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface StockCountItemRow {
  id: string;
  barcode: string;
  productId: string | null;
  productName: string | null;
  platformLabel: string | null;
  systemQuantity: number;
  countedQuantity: number;
  difference: number;
  differenceValue: number | null;
  unitCost: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockCountVarianceSummary {
  totalDifferenceUnits: number;
  totalDifferenceValue: number;
  itemsWithVariance: number;
}

export interface StockCountSessionDetail {
  id: string;
  organizationId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  status: StockCountSessionStatusApi;
  countMode: StockCountModeApi;
  filterBrand: string | null;
  filterCategory: string | null;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
  items: StockCountItemRow[];
  varianceSummary: StockCountVarianceSummary;
}
