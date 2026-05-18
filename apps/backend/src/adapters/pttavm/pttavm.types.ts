/** Pttavm sipariş listesi — API farklı şekillerde dönebilir */
export interface PttavmOrderRow {
  id?: string | number;
  orderId?: string | number;
  status?: string;
  buyer?: { fullName?: string; email?: string };
  totalPrice?: string | number;
  amount?: string | number;
  createdAt?: string;
  orderDate?: string;
}

/** Ürün listesi */
export interface PttavmProductRow {
  id?: string | number;
  barcode?: string;
  name?: string;
  title?: string;
  salePrice?: string | number;
  price?: string | number;
  stockAmount?: number;
  status?: string;
}

export interface PttavmProductsListResponse {
  products?: PttavmProductRow[];
  totalCount?: number;
}
