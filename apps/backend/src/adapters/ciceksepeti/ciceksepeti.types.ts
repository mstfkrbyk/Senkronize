/** Çiçeksepeti REST yanıtları (dokümantasyona göre doğrulanmalı). */

export interface CiceksepetiSupplierResponse {
  supplierId?: number;
  name?: string;
}

export interface CiceksepetiOrderLine {
  barcode?: string;
  productCode?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  orderItemId?: string | number;
}

export interface CiceksepetiOrder {
  orderId?: string | number;
  orderCode?: string;
  status?: string;
  customerName?: string;
  receiverName?: string;
  totalPrice?: number;
  orderTotal?: number;
  currency?: string;
  orderCreateDate?: string;
  createDate?: string;
  orderItems?: CiceksepetiOrderLine[];
  items?: CiceksepetiOrderLine[];
}

export interface CiceksepetiOrdersResponse {
  orders?: CiceksepetiOrder[];
  totalCount?: number;
  pageCount?: number;
}

export interface CiceksepetiProduct {
  productCode?: string;
  barcode?: string;
  productName?: string;
  name?: string;
  stockQuantity?: number;
  quantity?: number;
  salesPrice?: number;
  listPrice?: number;
  isActive?: boolean;
  active?: boolean;
  images?: string[] | { url?: string }[];
}

export interface CiceksepetiProductsResponse {
  products?: CiceksepetiProduct[];
  totalCount?: number;
  pageCount?: number;
}
