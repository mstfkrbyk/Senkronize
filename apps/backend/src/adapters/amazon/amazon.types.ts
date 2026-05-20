/** LWA (Login with Amazon) token yanıtı — yalnızca kullanılan alanlar */
export interface AmazonLwaTokenResponse {
  access_token: string;
  expires_in?: number;
}

/** Orders API v0 — sipariş satırı (minimal) */
export interface AmazonOrderPayload {
  AmazonOrderId: string;
  OrderStatus?: string;
  BuyerInfo?: {
    BuyerName?: string;
    BuyerEmail?: string;
  };
  OrderTotal?: {
    Amount?: string;
    CurrencyCode?: string;
  };
  PurchaseDate?: string;
}

export interface AmazonOrderItemPayload {
  OrderItemId?: string;
  ASIN?: string;
  SellerSKU?: string;
  Title?: string;
  QuantityOrdered?: number;
  ItemPrice?: {
    Amount?: string;
    CurrencyCode?: string;
  };
}

export interface AmazonOrderItemsListPayload {
  OrderItems?: AmazonOrderItemPayload[];
}

export interface AmazonOrderItemsResponse {
  payload?: AmazonOrderItemsListPayload;
}

export interface AmazonOrdersListPayload {
  Orders?: AmazonOrderPayload[];
  NextToken?: string;
}

export interface AmazonOrdersListResponse {
  payload?: AmazonOrdersListPayload;
}

/** Listings Items API — özet ve teklif (minimal) */
export interface AmazonListingItemSummary {
  itemName?: string;
  status?: string[];
  mainImage?: { link?: string };
}

export interface AmazonListingMoneyAmount {
  amount?: number;
}

export interface AmazonListingOfferPrice {
  listingPrice?: AmazonListingMoneyAmount;
}

export interface AmazonListingOffer {
  price?: AmazonListingOfferPrice;
}

export interface AmazonListingItem {
  sku: string;
  summaries?: AmazonListingItemSummary[];
  offers?: AmazonListingOffer[];
}

export interface AmazonListingsListResponse {
  items?: AmazonListingItem[];
  pagination?: { nextPageToken?: string };
}

/** Catalog Items API */
export interface AmazonCatalogItemSummary {
  itemName?: string;
  mainImage?: { link?: string };
}

export interface AmazonCatalogItem {
  asin?: string;
  summaries?: AmazonCatalogItemSummary[];
}

export interface AmazonCatalogItemsResponse {
  items?: AmazonCatalogItem[];
  pagination?: { nextToken?: string };
}

/** Feeds API */
export interface AmazonFeedDocumentResponse {
  feedDocumentId: string;
  url: string;
}

export interface AmazonFeedResponse {
  feedId: string;
}
