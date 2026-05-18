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
}

export interface MigrationImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}
