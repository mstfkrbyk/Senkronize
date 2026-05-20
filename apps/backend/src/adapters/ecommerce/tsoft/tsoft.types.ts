export interface TsoftOrderLine {
  id?: string | number;
  barcode?: string;
  sku?: string;
  productCode?: string;
  name?: string;
  productName?: string;
  quantity?: number;
  price?: number;
  unitPrice?: number;
}

export interface TsoftOrder {
  id?: string | number;
  orderId?: string | number;
  orderNo?: string | number;
  status?: string;
  orderStatus?: string;
  customer?: { fullName?: string; firstName?: string; lastName?: string };
  customerName?: string;
  total?: number;
  totalPrice?: number;
  currency?: string;
  createdAt?: string;
  orderDate?: string;
  items?: TsoftOrderLine[];
  orderItems?: TsoftOrderLine[];
}

export interface TsoftProduct {
  id?: string | number;
  productId?: string | number;
  barcode?: string;
  sku?: string;
  productCode?: string;
  name?: string;
  productName?: string;
  title?: string;
  stock?: number;
  stockAmount?: number;
  price?: number;
  salePrice?: number;
  listPrice?: number;
  compareAtPrice?: number;
  isActive?: boolean;
}

export interface TsoftStockUpdateItem {
  barcode: string;
  stock: number;
}

export interface TsoftPriceUpdateItem {
  barcode: string;
  price: number;
  listPrice?: number;
}
