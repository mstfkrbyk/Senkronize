export interface WishOrderLine {
  sku?: string;
  product_id?: string;
  quantity?: number;
  price?: number;
  name?: string;
}

export interface WishOrder {
  id?: string;
  order_id?: string;
  state?: string;
  status?: string;
  order_time?: string;
  updated_at?: string;
  product_items?: WishOrderLine[];
  items?: WishOrderLine[];
  total?: number;
  order_total?: number;
  currency_code?: string;
}

export interface WishProduct {
  id?: string;
  sku?: string;
  name?: string;
  inventory?: number;
  price?: number;
  enabled?: boolean;
}
