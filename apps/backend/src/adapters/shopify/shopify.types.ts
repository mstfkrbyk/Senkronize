/** Shopify Admin REST — varyant */
export interface ShopifyVariant {
  id?: number;
  sku?: string | null;
  price?: string;
  compare_at_price?: string | null;
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
  variant_id?: number | null;
}

/** Shopify Admin REST — müşteri */
export interface ShopifyCustomer {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

/** Shopify Admin REST — sipariş */
export interface ShopifyShippingAddress {
  address1?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface ShopifyOrder {
  id: number;
  order_number?: number | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  email?: string | null;
  customer?: ShopifyCustomer | null;
  shipping_address?: ShopifyShippingAddress | null;
  total_price?: string;
  currency?: string;
  created_at?: string;
  line_items?: ShopifyLineItem[];
}

/** Shopify Admin REST — lokasyon */
export interface ShopifyLocation {
  id: number;
}

/** Shopify Admin REST — envanter seviyesi */
export interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
}

/** Shopify Admin REST — webhook */
export interface ShopifyWebhook {
  id?: number;
  topic?: string;
  address?: string;
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

export interface ShopifyFulfillmentLineItem {
  id: number;
}

export interface ShopifyFulfillment {
  id?: number;
  tracking_number?: string | null;
  tracking_company?: string | null;
}
