/** Shopify Admin REST — varyant */
export interface ShopifyVariant {
  id?: number;
  sku?: string | null;
  price?: string;
  inventory_item_id?: number | null;
  inventory_quantity?: number | null;
}

/** Shopify Admin REST — ürün görseli */
export interface ShopifyImage {
  src?: string;
}

/** Shopify Admin REST — ürün */
export interface ShopifyProduct {
  id: number;
  title?: string;
  status?: string;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
}

/** Shopify Admin REST — sipariş satırı */
export interface ShopifyLineItem {
  id?: number;
  sku?: string | null;
  title?: string;
  quantity?: number;
  price?: string;
}

/** Shopify Admin REST — müşteri */
export interface ShopifyCustomer {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

/** Shopify Admin REST — sipariş */
export interface ShopifyOrder {
  id: number;
  financial_status?: string | null;
  email?: string | null;
  customer?: ShopifyCustomer | null;
  total_price?: string;
  currency?: string;
  created_at?: string;
  line_items?: ShopifyLineItem[];
}

/** Shopify Admin REST — lokasyon */
export interface ShopifyLocation {
  id: number;
}

export interface ShopifyProductsListResponse {
  products?: ShopifyProduct[];
}

export interface ShopifyOrdersListResponse {
  orders?: ShopifyOrder[];
}

export interface ShopifyLocationsListResponse {
  locations?: ShopifyLocation[];
}
