/**
 * T-Soft / OpenCart REST yanıtları mağaza sürümüne göre değişebilir;
 * burada yalnızca map için kullanılan alanlar tanımlıdır.
 */

export interface TsoftOrderProductRow {
  product_id?: string | number;
  order_product_id?: string | number;
  model?: string;
  sku?: string;
  name?: string;
  quantity?: string | number;
  price?: string | number;
}

export interface TsoftOrderRow {
  order_id?: string | number;
  id?: string | number;
  status_id?: string | number;
  status?: string | number;
  firstname?: string;
  lastname?: string;
  total?: string | number;
  currency_code?: string;
  date_added?: string;
  products?: TsoftOrderProductRow[];
  product?: TsoftOrderProductRow[];
}

export interface TsoftProductRow {
  product_id?: string | number;
  id?: string | number;
  model?: string;
  sku?: string;
  name?: string;
  quantity?: string | number;
  price?: string | number;
  image?: string;
  thumb?: string;
  status?: string | number;
}
