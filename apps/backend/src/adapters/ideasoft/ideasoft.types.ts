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
  status?: string;
  customer?: { fullName?: string; name?: string };
  customerName?: string;
  total?: number;
  totalAmount?: number;
  currency?: string;
  createdAt?: string;
  createDate?: string;
  items?: IdeasoftOrderLine[];
  orderItems?: IdeasoftOrderLine[];
}

export interface IdeasoftOrdersResponse {
  data?: IdeasoftOrder[];
  items?: IdeasoftOrder[];
}

export interface IdeasoftProduct {
  id?: string | number;
  barcode?: string;
  name?: string;
  title?: string;
  stockAmount?: number;
  quantity?: number;
  price?: number;
  oldPrice?: number;
  listPrice?: number;
  images?: { url?: string }[] | string[];
}

export interface IdeasoftProductsResponse {
  data?: IdeasoftProduct[];
  items?: IdeasoftProduct[];
  meta?: { total?: number; itemCount?: number };
  total?: number;
}
