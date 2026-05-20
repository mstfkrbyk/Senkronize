/** WooCommerce REST — sipariş satırı */
export interface WcOrderLineItem {
  id?: number;
  sku?: string;
  product_id?: number;
  variation_id?: number;
  name?: string;
  quantity?: number;
  price?: string;
}

/** WooCommerce REST — fatura adresi (alıcı) */
export interface WcOrderAddress {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  city?: string;
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
  sale_price?: string;
  status?: string;
  type?: string;
  stock_quantity?: number | null;
  manage_stock?: boolean;
  images?: WcProductImage[];
}

/** WooCommerce REST — varyant */
export interface WcVariation {
  id: number;
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number | null;
  manage_stock?: boolean;
}

/** WooCommerce REST — webhook kaydı */
export interface WcWebhook {
  id: number;
  topic?: string;
  delivery_url?: string;
  status?: string;
}
