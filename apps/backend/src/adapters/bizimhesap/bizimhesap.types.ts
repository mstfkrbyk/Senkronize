export interface BizimHesapAuthResponse {
  access_token: string;
  expires_in: number;
}

export interface BizimHesapProduct {
  id: string;
  barcode: string;
  name: string;
  stock_quantity: number;
  purchase_price?: number;
}

export interface BizimHesapProductsResponse {
  data: BizimHesapProduct[];
  meta: { total: number; page: number; per_page: number };
}

export interface BizimHesapInvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
}

export interface BizimHesapInvoice {
  id: string;
  invoice_no: string;
  reference: string;
  total_amount: number;
  currency: string;
  issue_date: string;
  lines: BizimHesapInvoiceLine[];
}

export interface BizimHesapInvoicesResponse {
  data: BizimHesapInvoice[];
  meta: { total: number };
}
