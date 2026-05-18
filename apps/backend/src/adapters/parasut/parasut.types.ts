export interface ParasutTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface ParasutProduct {
  id: string;
  type: 'products';
  attributes: {
    code: string;
    name: string;
    unit: string;
    vat_rate: number;
    purchase_price?: number;
  };
}

export interface ParasutProductsResponse {
  data: ParasutProduct[];
  meta: { current_page: number; total_pages: number; total_count: number };
}

export interface ParasutInvoiceAttributes {
  item_type: 'invoice';
  description: string;
  issue_date: string;
  due_date: string;
  currency: string;
  net_total: number;
  gross_total: number;
}

export interface ParasutInvoice {
  id: string;
  type: 'sales_invoices';
  attributes: ParasutInvoiceAttributes;
}

export interface ParasutContactAttributes {
  name?: string;
  title?: string;
  email?: string;
}

export interface ParasutContact {
  id: string;
  type: 'contacts';
  attributes: ParasutContactAttributes;
}

export interface ParasutContactsResponse {
  data: ParasutContact[];
}

export interface ParasutEInvoiceAttributes {
  scenario?: string;
  to?: string;
  invoice_series?: string;
  invoice_id?: string;
  [key: string]: unknown;
}

export interface ParasutEInvoice {
  id: string;
  type: 'e_invoices';
  attributes: ParasutEInvoiceAttributes;
}
