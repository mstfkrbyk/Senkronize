// GET …/order/sellers/{sellerId}/orders (V2) — V1'de content, V2'de orders
export interface TrendyolOrderLine {
  quantity: number;
  salesCampaignId: number;
  productSize: string;
  merchantSku: string;
  productName: string;
  productCode: number;
  merchantId: number;
  amount: number;
  discount: number;
  discountDetails: unknown[];
  currencyCode: string;
  productColor: string;
  id: number;
  sku: string;
  vatBaseAmount: number;
  barcode: string;
  orderLineItemStatusName: string;
  price: number;
}

export interface TrendyolOrder {
  shipmentAddress: { firstName: string; lastName: string };
  orderNumber: string;
  grossAmount: number;
  totalDiscount: number;
  taxNumber: string | null;
  invoiceAddress: unknown;
  lines: TrendyolOrderLine[];
  orderDate: number; // unix ms
  tcIdentityNumber: string;
  currencyCode: string;
  packageHistories: Array<{ status: string; createdDate: number }>;
  id: number;
  cargoTrackingNumber?: string;
  cargoProviderName?: string;
  status: string;
}

/** V1: content, totalElements — V2: orders, totalCount */
export interface TrendyolOrdersResponse {
  content?: TrendyolOrder[];
  orders?: TrendyolOrder[];
  totalElements?: number;
  totalCount?: number;
  totalPages: number;
  page: number;
  size: number;
}

// GET …/product/sellers/{sellerId}/products
export interface TrendyolProduct {
  id: string;
  approved: boolean;
  barcode: string;
  title: string;
  productMainId: string;
  brandId: number;
  brandName: string;
  stockUnitType: string;
  quantity: number;
  listPrice: number;
  salePrice: number;
  vatRate: number;
  images: Array<{ url: string }>;
}

export interface TrendyolProductsResponse {
  content?: TrendyolProduct[];
  products?: TrendyolProduct[];
  totalElements?: number;
  totalCount?: number;
  totalPages: number;
  page: number;
  size: number;
}
