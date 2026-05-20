/** Jumia Vendor REST API — sipariş satırı */
export interface JumiaOrderRow {
  id?: string | number;
  order_id?: string | number;
  order_number?: string;
  status?: string;
  created_at?: string;
  order_date?: string;
  customer_name?: string;
  buyer_name?: string;
  currency?: string;
  total?: number | string;
  total_amount?: number | string;
  grand_total?: number | string;
  tracking_number?: string;
}
