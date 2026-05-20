export interface IdeasoftTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface IdeasoftOrderLine {
  id?: string | number;
  barcode?: string;
  sku?: string;
  name?: string;
  quantity?: number;
  price?: number;
  unitPrice?: number;
}

export interface IdeasoftOrder {
  id?: string | number;
  orderNumber?: string | number;
  order_number?: string | number;
  status?: string | number;
  order_status_id?: number;
  customer?: { fullName?: string; name?: string; email?: string; phone?: string };
  customerName?: string;
  customerEmail?: string;
  shippingAddress?: { address?: string; fullAddress?: string; city?: string; country?: string };
  trackingNumber?: string;
  cargoCompany?: string;
  total?: number;
  totalAmount?: number;
  currency?: string;
  createdAt?: string;
  createDate?: string;
  items?: IdeasoftOrderLine[];
  orderItems?: IdeasoftOrderLine[];
}

export interface IdeasoftProduct {
  id?: string | number;
  barcode?: string;
  sku?: string;
  name?: string;
  title?: string;
  stock?: number;
  stockAmount?: number;
  quantity?: number;
  price?: number;
  oldPrice?: number;
  listPrice?: number;
  status?: string | number;
  images?: { url?: string }[] | string[];
}

export interface IdeasoftStockStatusPayload {
  stock: number;
  stock_type_id: number;
}

export interface IdeasoftPricePayload {
  price: number;
  currency_code: string;
}
