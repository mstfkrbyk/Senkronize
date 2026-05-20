export enum ListingStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  PENDING = 'PENDING',
}

export enum ListingSort {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  STOCK_ASC = 'stock_asc',
  STOCK_DESC = 'stock_desc',
  UPDATED_DESC = 'updated_desc',
}

export interface BulkResult {
  success: number;
  failed: number;
  errors: { id: string; message: string }[];
}

export interface ListingSyncError {
  id: string;
  action: string;
  message: string;
  createdAt: string;
}
