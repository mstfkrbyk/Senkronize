/** WooCommerce REST — sipariş satırı */
export interface WcOrderLineItem {
  id?: number;
  sku?: string;
  product_id?: number;
  name?: string;
  quantity?: number;
  price?: string;
}

/** WooCommerce REST — fatura adresi (alıcı) */
export interface WcOrderAddress {
  first_name?: string;
  last_name?: string;
  email?: string;
}

/** WooCommerce REST — sipariş */
export interface WcOrder {
  id: number;
  status?: string;
  total?: string;
  currency?: string;
  date_created?: string;
  billing?: WcOrderAddress;
  shipping?: Record<string, unknown>;
  line_items?: WcOrderLineItem[];
}

/** WooCommerce REST — ürün görseli */
export interface WcProductImage {
  src?: string;
}

/** WooCommerce REST — ürün */
export interface WcProduct {
  id: number;
  sku?: string;
  name?: string;
  price?: string;
  regular_price?: string;
  status?: string;
  stock_quantity?: number | null;
  images?: WcProductImage[];
}
