export interface CoupangOrdersheetRow {
  orderId?: number | string;
  shipmentBoxId?: number | string;
  orderedAt?: string;
  orderer?: { name?: string };
  receiver?: { name?: string };
  orderItems?: CoupangOrderItemRow[];
  paidAt?: string;
  status?: string;
}

export interface CoupangOrderItemRow {
  vendorItemId?: number | string;
  sellerProductId?: number | string;
  sellerProductItemId?: number | string;
  sellerProductName?: string;
  shippingCount?: number;
  salesPrice?: number;
  orderPrice?: number;
  externalVendorSku?: string;
}

export interface CoupangProductRow {
  sellerProductId?: number | string;
  sellerProductName?: string;
  items?: CoupangProductOptionRow[];
}

export interface CoupangProductOptionRow {
  vendorItemId?: number | string;
  sellerProductItemId?: number | string;
  externalVendorSku?: string;
  salePrice?: number;
  originalPrice?: number;
  maximumBuyCount?: number;
  outboundShippingTimeDay?: number;
}
