import type {
  CustomerImportDto,
  OrderImportDto,
  ProductImportDto,
  StockMovementImportDto,
} from './migration.import-dto';

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

export interface MigrationRow {
  barcode: string;
  name: string;
  category?: string;
  brand?: string;
  salePrice: number;
  listPrice?: number;
  stock?: number;
  description?: string;
  imageUrl?: string;
  sku?: string;
}

export interface MigrationImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

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

export interface MigrationSession {
  id: string;
  organizationId: string;
  userId?: string;
  dataType: MigrationDataType;
  sourceFormat: MigrationSourceFormat;
  fileName: string;
  mimeType: string;
  headers: string[];
  rawRows: Record<string, string>[];
  columnMapping: Record<string, string>;
  status: MigrationSessionStatus;
  validationResult?: MigrationValidationResult;
  progress: MigrationSessionProgress;
  rowErrors: MigrationFieldIssue[];
  createdAt: string;
  updatedAt: string;
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

export type MigrationNormalizedRow =
  | ProductImportDto
  | OrderImportDto
  | CustomerImportDto
  | StockMovementImportDto;

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
