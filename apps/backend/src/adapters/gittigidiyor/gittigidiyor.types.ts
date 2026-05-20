export interface GittigidiyorApiEnvelope<T = unknown> {
  ackCode?: string;
  error?: { errorId?: string; message?: string };
  [key: string]: unknown;
  data?: T;
}

export interface GittigidiyorProductRow {
  productId?: string | number;
  productCode?: string;
  itemId?: string;
  title?: string;
  price?: number;
  stockAmount?: number;
  stock?: number;
  quantity?: number;
  active?: boolean | number;
  images?: Array<{ imageUrl?: string; url?: string }>;
}

export interface GittigidiyorProductsPayload {
  products?: GittigidiyorProductRow[];
  product?: GittigidiyorProductRow | GittigidiyorProductRow[];
  items?: GittigidiyorProductRow[];
  totalCount?: number;
}

export interface GittigidiyorOrderRow {
  orderId?: string | number;
  saleCode?: string;
  productTitle?: string;
  buyerName?: string;
  buyer?: string;
  price?: number;
  amount?: number;
  status?: string | number;
  orderDate?: string;
  cargoCode?: string;
  cargoCompany?: string;
  items?: Array<{
    productCode?: string;
    stockCode?: string;
    quantity?: number;
    price?: number;
    title?: string;
  }>;
}

export interface GittigidiyorOrdersPayload {
  orders?: GittigidiyorOrderRow[];
  order?: GittigidiyorOrderRow | GittigidiyorOrderRow[];
}
