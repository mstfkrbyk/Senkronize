export interface EbayOAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface EbayFulfillmentLineItem {
  sku?: string;
  lineItemId?: string;
  quantity?: number;
  lineItemCost?: { value?: string };
  title?: string;
}

export interface EbayFulfillmentOrder {
  orderId?: string;
  orderFulfillmentStatus?: string;
  creationDate?: string;
  pricingSummary?: { total?: { value?: string; currency?: string } };
  lineItems?: EbayFulfillmentLineItem[];
  buyer?: { username?: string };
}

export interface EbayOrdersResponse {
  orders?: EbayFulfillmentOrder[];
  total?: number;
  next?: string;
}

export interface EbayOfferSummary {
  offerId?: string;
  sku?: string;
}

export interface EbayOffersBySkuResponse {
  offers?: EbayOfferSummary[];
}

export interface EbayInventoryProduct {
  title?: string;
  ean?: string[];
}

export interface EbayInventoryItemPayload {
  availability?: {
    shipToLocationAvailability?: { quantity?: number };
  };
  condition?: string;
  product?: EbayInventoryProduct;
}

export interface EbayShippingLineItem {
  lineItemId: string;
  quantity: number;
}

export interface EbayShippingFulfillmentPayload {
  orderId: string;
  lineItems: EbayShippingLineItem[];
  trackingNumber: string;
  shippingCarrierCode?: string;
  shippedDate?: string;
}
