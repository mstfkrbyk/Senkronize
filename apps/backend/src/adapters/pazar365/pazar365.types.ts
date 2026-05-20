export interface Pazar365OrderRow {
  id?: string | number;
  orderId?: string | number;
  status?: string;
  customerName?: string;
  buyerName?: string;
  totalPrice?: number | string;
  totalAmount?: number | string;
  createdAt?: string;
  orderDate?: string;
  cargoTrackingNumber?: string;
  trackingNumber?: string;
  cargoCode?: string;
}

export interface Pazar365OrdersResponse {
  data?: Pazar365OrderRow[];
  items?: Pazar365OrderRow[];
  orders?: Pazar365OrderRow[];
  totalCount?: number;
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface Pazar365ProductRow {
  id?: string | number;
  productCode?: string;
  code?: string;
  barcode?: string;
  sku?: string;
  name?: string;
  title?: string;
  price?: number | string;
  discountedPrice?: number | string;
  salePrice?: number | string;
  quantity?: number;
  stock?: number;
  status?: string;
}

export interface Pazar365ProductsResponse {
  data?: Pazar365ProductRow[];
  items?: Pazar365ProductRow[];
  products?: Pazar365ProductRow[];
  totalCount?: number;
  total?: number;
}
