export interface BoynerTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface BoynerOrderLine {
  sku?: string;
  barcode?: string;
  quantity?: number;
  unit_price?: number;
  name?: string;
  id?: string | number;
}

export interface BoynerOrder {
  id?: string | number;
  status?: string;
  buyer_name?: string;
  total?: number;
  currency?: string;
  created_at?: string;
  lines?: BoynerOrderLine[];
}

export interface BoynerProduct {
  id?: string | number;
  barcode?: string;
  sku?: string;
  title?: string;
  stock?: number;
  sale_price?: number;
  list_price?: number;
  approved?: boolean;
}
