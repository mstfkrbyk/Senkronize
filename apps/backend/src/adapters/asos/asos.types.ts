export interface AsosOrderLine {
  productCode?: string;
  sku?: string;
  quantity?: number;
  unitPrice?: number;
  productName?: string;
}

export interface AsosOrder {
  orderId?: string;
  id?: string;
  status?: string;
  customerName?: string;
  orderDate?: string;
  createdAt?: string;
  lines?: AsosOrderLine[];
  items?: AsosOrderLine[];
  total?: number;
  currency?: string;
}

export interface AsosProduct {
  productCode?: string;
  sku?: string;
  title?: string;
  quantity?: number;
  stock?: number;
  salePrice?: number;
  listPrice?: number;
  price?: number;
}
