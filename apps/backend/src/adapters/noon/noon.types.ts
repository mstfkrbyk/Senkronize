/** Noon Partner API yanıtları — yalnızca kullanılan alanlar. */
export interface NoonOrderRow {
  order_nr?: string;
  order_number?: string;
  id?: string;
  status?: string;
  created_at?: string;
  currency_code?: string;
  total?: number | string;
  items?: NoonOrderLine[];
}

export interface NoonOrderLine {
  sku?: string;
  partner_sku?: string;
  quantity?: number;
  unit_price?: number | string;
  title?: string;
}

export interface NoonOrdersEnvelope {
  data?: NoonOrderRow[];
  orders?: NoonOrderRow[];
  results?: NoonOrderRow[];
  items?: NoonOrderRow[];
}

export interface NoonProductRow {
  sku?: string;
  partner_sku?: string;
  title?: string;
  name?: string;
  quantity?: number;
  stock?: number;
  available_quantity?: number;
  price?: number | string;
  selling_price?: number | string;
  list_price?: number | string;
  status?: string;
}

export interface NoonProductsEnvelope {
  data?: NoonProductRow[];
  products?: NoonProductRow[];
  results?: NoonProductRow[];
  items?: NoonProductRow[];
  total?: number;
  count?: number;
}
