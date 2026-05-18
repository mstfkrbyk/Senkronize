/** Luca (luca.com.tr) bulut muhasebe REST — yanıt şekilleri API sürümüne göre değişebilir */

export interface LucaProduct {
  id?: string;
  code?: string;
  sku?: string;
  name?: string;
  title?: string;
  stockQuantity?: number;
  quantity?: number;
  purchasePrice?: number;
  barcode?: string;
}

export interface LucaProductsResponse {
  data?: LucaProduct[];
  products?: LucaProduct[];
  items?: LucaProduct[];
}

export interface LucaInvoiceCreateResponse {
  id?: string;
  invoiceNumber?: string;
  number?: string;
}
