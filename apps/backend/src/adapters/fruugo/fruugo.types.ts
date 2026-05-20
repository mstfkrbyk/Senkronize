export interface FruugoOrderLine {
  sku?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  name?: string;
}

export interface FruugoOrder {
  orderId?: string;
  id?: string;
  status?: string;
  customerName?: string;
  orderDate?: string;
  createdAt?: string;
  lines?: FruugoOrderLine[];
  items?: FruugoOrderLine[];
  total?: number;
  currency?: string;
}

export interface FruugoProduct {
  productId?: string;
  id?: string;
  sku?: string;
  title?: string;
  stock?: number;
  price?: number;
  currency?: string;
}
