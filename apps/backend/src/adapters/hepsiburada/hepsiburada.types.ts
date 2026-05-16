export interface HepsiburadaOrderItem {
  lineItemId: string;
  merchantSku: string;
  productName: string;
  quantity: number;
  price: number;
  tax: number;
  barcode: string;
}

export interface HepsiburadaOrder {
  orderNumber: string;
  status: string;
  customerId: string;
  customerName: string;
  orderDate: string; // ISO
  lineItems: HepsiburadaOrderItem[];
  totalPrice: number;
  shippingDetails?: { trackingNumber?: string; providerName?: string };
}

export interface HepsiburadaOrdersResponse {
  data: {
    orders: HepsiburadaOrder[];
    pageCount: number;
    totalCount: number;
  };
}

export interface HepsiburadaListing {
  hepsiburadaSku: string;
  merchantSku: string;
  barcode: string;
  productName: string;
  availableStock: number;
  price: number;
  listPrice: number;
  isSalable: boolean;
  images: string[];
}

export interface HepsiburadaListingsResponse {
  data: {
    listings: HepsiburadaListing[];
    pageCount: number;
    totalCount: number;
  };
}
