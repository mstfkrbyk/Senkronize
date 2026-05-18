/** Logo Tiger / Logo Go REST (LogoService API) — yanıt şekilleri kuruluma göre değişebilir */

export interface LogoTokenResponse {
  token: string;
  expiresAt: string;
}

export interface LogoItem {
  code?: string;
  description?: string;
  stockQty?: number;
  salesPrice?: number;
  barcode?: string;
}

export interface LogoItemsResponse {
  items?: LogoItem[];
}

export interface LogoStockRow {
  productCode?: string;
  itemCode?: string;
  quantity?: number;
  warehouseCode?: string;
}

export interface LogoStocksResponse {
  stocks?: LogoStockRow[];
}

export interface LogoInvoiceCreateResponse {
  invoiceNumber?: string;
  number?: string;
  id?: string;
}
