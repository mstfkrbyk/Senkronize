export type TransferStatusApi =
  | 'DRAFT'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED';

export interface StockTransferItem {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantity: number;
}

export interface StockTransferRow {
  id: string;
  organizationId: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  fromWarehouseCode: string;
  toWarehouseId: string;
  toWarehouseName: string;
  toWarehouseCode: string;
  status: TransferStatusApi;
  note: string | null;
  createdBy: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  totalQuantity: number;
}

export interface StockTransferDetail extends StockTransferRow {
  items: StockTransferItem[];
}
