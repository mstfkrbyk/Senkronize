/** Getir merchant API — yanıt şekilleri (dokümantasyona göre genişletilebilir) */
export interface GetirTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface GetirOrderLine {
  sku?: string;
  barcode?: string;
  quantity?: number;
  unit_price?: number;
  product_name?: string;
  id?: string | number;
}

export interface GetirOrder {
  id?: string | number;
  order_id?: string | number;
  status?: string;
  customer_name?: string;
  total_amount?: number;
  currency?: string;
  created_at?: string;
  lines?: GetirOrderLine[];
  items?: GetirOrderLine[];
  tracking_number?: string;
  courier_name?: string;
}

export interface GetirOrdersEnvelope {
  data?: GetirOrder[];
  orders?: GetirOrder[];
  items?: GetirOrder[];
}

export interface GetirProduct {
  id?: string | number;
  sku?: string;
  barcode?: string;
  title?: string;
  name?: string;
  stock?: number;
  quantity?: number;
  sale_price?: number;
  list_price?: number;
  active?: boolean;
  images?: Array<{ url?: string } | string>;
}

export interface GetirProductsEnvelope {
  data?: GetirProduct[];
  products?: GetirProduct[];
  total?: number;
  total_count?: number;
}
