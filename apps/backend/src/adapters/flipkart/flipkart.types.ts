export interface FlipkartTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface FlipkartOrderItem {
  orderItemId?: string;
  fsn?: string;
  sku?: string;
  skuId?: string;
  title?: string;
  quantity?: number;
  price?: number;
  sellingPrice?: number;
}

export interface FlipkartOrderSummary {
  orderId?: string;
  orderDate?: string;
  orderState?: string;
  buyerName?: string;
  customerName?: string;
  orderItems?: FlipkartOrderItem[];
  subOrders?: Array<{ subOrderId?: string; orderItems?: FlipkartOrderItem[] }>;
  totalAmount?: number;
  orderAmount?: number;
}

export interface FlipkartOrdersFilterResponse {
  orderList?: FlipkartOrderSummary[];
  orders?: FlipkartOrderSummary[];
  orderItems?: FlipkartOrderSummary[];
  hasMore?: boolean;
  nextPageNumber?: number;
  nextPageUrl?: string;
}

export interface FlipkartListingRow {
  fsn?: string;
  sku?: string;
  skuId?: string;
  productTitle?: string;
  title?: string;
  listingStatus?: string;
  status?: string;
  inventory?: { quantity?: number; available?: number };
  price?: {
    currency?: string;
    mrp?: number;
    selling_price?: number;
    sellingPrice?: number;
  };
  available?: number;
  mrp?: number;
  sellingPrice?: number;
}

export interface FlipkartListingsV3Response {
  listings?: FlipkartListingRow[];
  available?: FlipkartListingRow[];
  hasMore?: boolean;
  nextPageUrl?: string;
  totalCount?: number;
}

export interface FlipkartListingsResponse {
  listings?: FlipkartListingRow[];
  available?: FlipkartListingRow[];
}

export interface FlipkartDispatchShipment {
  orderItemId: string;
  fsn: string;
  quantity: number;
  trackingId: string;
  serviceName: string;
  carrierCode?: string;
}

export interface FlipkartDispatchPayload {
  shipments: FlipkartDispatchShipment[];
}

/** @deprecated Eski uç; dispatchOrder kullanın */
export interface FlipkartShipmentPayload {
  orderId: string;
  subOrderIds: string[];
  trackingId: string;
  serviceName?: string;
}
