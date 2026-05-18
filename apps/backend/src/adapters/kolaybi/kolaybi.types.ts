export interface KolaybiProductRow {
  id?: string;
  code?: string;
  sku?: string;
  name?: string;
  title?: string;
  stockQuantity?: number;
  quantity?: number;
  purchasePrice?: number;
}

export interface KolaybiProductsEnvelope {
  data?: KolaybiProductRow[];
  items?: KolaybiProductRow[];
}

export interface KolaybiInvoiceCreateResponse {
  id?: string;
  invoiceNumber?: string;
  number?: string;
}
