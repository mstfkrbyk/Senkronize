export interface BizimHesapProductRow {
  id: string;
  code?: string;
  barcode?: string;
  name: string;
  unit?: string;
  stock_quantity?: number;
  purchase_price?: number;
  sale_price?: number;
}

export interface BizimHesapProductsResponse {
  data: BizimHesapProductRow[];
  meta?: { total?: number; page?: number; per_page?: number };
}

export interface BizimHesapStockItemRow {
  id: string;
  quantity?: number;
  warehouse_name?: string;
}

export interface BizimHesapStockItemsResponse {
  data: BizimHesapStockItemRow[];
}

export interface BizimHesapContactRow {
  id: string;
  name?: string;
  email?: string;
  type?: string;
}

export interface BizimHesapContactsResponse {
  data: BizimHesapContactRow[];
  meta?: { total?: number; page?: number; per_page?: number };
}

export interface BizimHesapInvoiceLineRow {
  product_id?: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
  tax_rate?: number;
  total?: number;
  description?: string;
}

export interface BizimHesapInvoiceRow {
  id: string;
  invoice_no?: string;
  issue_date?: string;
  contact_id?: string;
  total_amount?: number;
  currency?: string;
  lines?: BizimHesapInvoiceLineRow[];
}

export interface BizimHesapInvoicesResponse {
  data: BizimHesapInvoiceRow[];
  meta?: { total?: number; page?: number; per_page?: number };
}

export interface BizimHesapCategoryRow {
  id: string;
  name: string;
}

export interface BizimHesapCategoriesResponse {
  data: BizimHesapCategoryRow[];
}

export interface BizimHesapAccountEntry {
  id: string;
  date?: string;
  description?: string;
  debit?: number;
  credit?: number;
  balance?: number;
}

export interface BizimHesapAccountEntriesResponse {
  data: BizimHesapAccountEntry[];
}

export interface BizimHesapStockUpdateItem {
  barcode: string;
  quantity: number;
}
