/** OpenCart REST API extension — gevşek JSON yanıtları */
export interface OcOrderRow {
  order_id?: string | number;
  orderId?: string | number;
  status?: string;
  firstname?: string;
  lastname?: string;
  total?: string | number;
  currency_code?: string;
  date_added?: string;
  products?: OcOrderLine[];
}

export interface OcOrderLine {
  product_id?: string | number;
  productId?: string | number;
  sku?: string;
  model?: string;
  name?: string;
  quantity?: string | number;
  price?: string | number;
}

export interface OcProductRow {
  product_id?: string | number;
  productId?: string | number;
  sku?: string;
  model?: string;
  name?: string;
  quantity?: string | number;
  price?: string | number;
  status?: string | number;
  image?: string;
}
