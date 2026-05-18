/** Pazaryeri REST stub yanıtları — alanlar opsiyonel (gerçek API şemasına göre güncellenir) */

export interface StubRestOrderLine {
  id?: string | number;
  sku?: string;
  barcode?: string;
  quantity?: number;
  unit_price?: number;
  price?: number;
  product_name?: string;
  title?: string;
}

export interface StubRestOrder {
  id?: string | number;
  order_id?: string | number;
  order_sn?: string | number;
  status?: string;
  customer_name?: string;
  buyer_username?: string;
  total_amount?: number;
  total?: number;
  currency?: string;
  created_at?: string;
  create_time?: string | number;
  lines?: StubRestOrderLine[];
  items?: StubRestOrderLine[];
  tracking_number?: string;
  courier_name?: string;
}

export interface StubRestProduct {
  id?: string | number;
  sku?: string;
  barcode?: string;
  title?: string;
  name?: string;
  sale_price?: number;
  list_price?: number;
  price?: number;
  stock?: number;
  quantity?: number;
  active?: boolean;
  images?: Array<string | { url?: string }>;
}

export interface OAuthTokenResponse {
  access_token?: string;
}
