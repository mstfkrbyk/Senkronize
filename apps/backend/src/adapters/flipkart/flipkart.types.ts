export interface FlipkartOrderItem {
  orderItemId?: string;
  fsn?: string;
  sku?: string;
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
  hasMore?: boolean;
  nextPageNumber?: number;
}

export interface FlipkartListingRow {
  fsn?: string;
  sku?: string;
  productTitle?: string;
  title?: string;
  listingStatus?: string;
  inventory?: { quantity?: number };
  price?: {
    currency?: string;
    mrp?: number;
    selling_price?: number;
    sellingPrice?: number;
  };
}

export interface FlipkartListingsResponse {
  listings?: FlipkartListingRow[];
  available?: FlipkartListingRow[];
}

export interface FlipkartShipmentPayload {
  orderId: string;
  subOrderIds: string[];
  trackingId: string;
  serviceName?: string;
}
