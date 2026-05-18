/** Noon REST yanıtları — platforma göre değişebilir; yalnızca kullanılan alanlar. */
export interface NoonOrderRow {
  order_nr?: string;
  order_number?: string;
  id?: string;
  status?: string;
  created_at?: string;
  currency_code?: string;
  total?: number | string;
  items?: Array<{
    sku?: string;
    partner_sku?: string;
    quantity?: number;
    unit_price?: number | string;
    title?: string;
  }>;
}

export interface NoonOrdersEnvelope {
  data?: NoonOrderRow[];
  orders?: NoonOrderRow[];
  results?: NoonOrderRow[];
}
