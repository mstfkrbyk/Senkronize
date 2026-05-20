export interface KolaybiProductRow {
  id?: string;
  code?: string;
  sku?: string;
  name?: string;
  title?: string;
  stockQuantity?: number;
  quantity?: number;
  stock?: number;
  purchasePrice?: number;
  price?: number;
}

export interface KolaybiPaginatedMeta {
  current_page?: number;
  last_page?: number;
  total?: number;
}

export interface KolaybiPaginatedResponse<T> {
  data?: T[];
  meta?: KolaybiPaginatedMeta;
  items?: T[];
}

export interface KolaybiInvoiceCreateResponse {
  id?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  number?: string;
}

export interface KolaybiInvoiceRow {
  id?: string;
  invoiceNumber?: string;
  number?: string;
  externalReference?: string;
  orderRef?: string;
  totalAmount?: number;
  currency?: string;
  issueDate?: string;
  createdAt?: string;
}
