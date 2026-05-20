export type MigrationDataType =
  | 'products'
  | 'orders'
  | 'stock_movements'
  | 'customers';

export type MigrationSourceFormat =
  | 'generic_csv'
  | 'generic_excel'
  | 'generic_json'
  | 'entegra_json'
  | 'woocommerce_xml'
  | 'woocommerce_csv'
  | 'shopify_csv'
  | 'ticimax_csv'
  | 'kolay_ik_json';

export type MigrationSessionStatus =
  | 'uploaded'
  | 'mapped'
  | 'validated'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface MigrationFieldIssue {
  row: number;
  field: string;
  message: string;
}

export interface MigrationValidationResult {
  total: number;
  valid: number;
  errors: MigrationFieldIssue[];
  warnings: MigrationFieldIssue[];
}

export interface MigrationSessionProgress {
  processed: number;
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface MigrationUploadResponse {
  sessionId: string;
  dataType: MigrationDataType;
  sourceFormat: MigrationSourceFormat;
  totalRows: number;
  headers: string[];
}

export interface MigrationPreviewResponse {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export interface MigrationStatusResponse {
  sessionId: string;
  status: MigrationSessionStatus;
  progress: MigrationSessionProgress;
  validation?: MigrationValidationResult;
}

export interface MigrationExecuteResponse {
  jobId: string;
  sessionId: string;
}

export interface MigrationProgressEvent {
  sessionId: string;
  processed: number;
  total: number;
  imported: number;
  failed: number;
}

export interface MigrationHistoryItem {
  id: string;
  createdAt: string;
  sourceFormat: MigrationSourceFormat;
  sourceLabel: string;
  dataType: MigrationDataType;
  fileName: string;
  total: number;
  success: number;
  failed: number;
  status: MigrationSessionStatus;
  errors?: MigrationFieldIssue[];
}

export const MIGRATION_TARGET_FIELDS: Record<MigrationDataType, string[]> = {
  products: [
    'name',
    'sku',
    'barcode',
    'price',
    'listPrice',
    'stock',
    'category',
    'brand',
    'description',
    'imageUrl',
  ],
  orders: [
    'platformOrderId',
    'platform',
    'orderDate',
    'status',
    'customerName',
    'customerEmail',
    'customerPhone',
    'shippingAddress',
    'totalAmount',
    'currency',
    'cargoTrackingNumber',
    'cargoProvider',
    'itemSku',
    'itemBarcode',
    'itemName',
    'itemQuantity',
    'itemUnitPrice',
  ],
  stock_movements: [
    'barcode',
    'movementType',
    'quantity',
    'date',
    'note',
    'platform',
  ],
  customers: ['name', 'email', 'phone', 'platform', 'externalId'],
};
