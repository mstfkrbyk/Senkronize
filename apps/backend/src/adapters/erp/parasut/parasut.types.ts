export interface ParasutTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

export interface ParasutProductAttributes {
  name: string;
  code?: string;
  inventory_tracking?: boolean;
  initial_stock_count?: number;
  stock_count?: number;
  purchase_price?: number;
  vat_rate?: number;
}

export interface ParasutMeResponse {
  data: {
    id: string;
    attributes: {
      name?: string;
    };
  };
}

export interface ParasutInvoiceAttributes {
  item_type: string;
  description?: string;
  issue_date: string;
  due_date?: string;
  currency: string;
  net_total?: number;
  gross_total?: number;
  invoice_no?: string;
  lines?: Array<{
    quantity: number;
    unit_price: number;
    vat_rate: number;
    description: string;
  }>;
}

export interface ParasutContactAttributes {
  name?: string;
  email?: string;
  contact_type?: string;
}

export interface ParasutJsonApiSingle<T> {
  data: { id: string; attributes: T };
}

export interface ParasutJsonApiList<T> {
  data: Array<{ id: string; attributes: T }>;
  meta?: { total_pages?: number; total_count?: number };
}
