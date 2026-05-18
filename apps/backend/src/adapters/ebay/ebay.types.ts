export interface EbayOAuthTokenResponse {
  access_token?: string;
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
  pricingSummary?: { total?: { value?: string } };
  lineItems?: EbayFulfillmentLineItem[];
  buyer?: { username?: string };
}

export interface EbayOrdersResponse {
  orders?: EbayFulfillmentOrder[];
  total?: number;
}
