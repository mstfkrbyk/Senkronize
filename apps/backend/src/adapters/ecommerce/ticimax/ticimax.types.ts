export interface TicimaxOrderLine {
  id?: string | number;
  productCode?: string;
  ProductCode?: string;
  barcode?: string;
  Barcode?: string;
  quantity?: number;
  Quantity?: number;
  unitPrice?: number;
  UnitPrice?: number;
  price?: number;
  Price?: number;
  productName?: string;
  ProductName?: string;
  name?: string;
  Name?: string;
}

export interface TicimaxOrder {
  id?: string | number;
  Id?: string | number;
  orderNo?: string | number;
  OrderNo?: string | number;
  status?: string | number;
  Status?: string | number;
  customerName?: string;
  CustomerName?: string;
  firstName?: string;
  FirstName?: string;
  lastName?: string;
  LastName?: string;
  totalAmount?: number;
  TotalAmount?: number;
  total?: number;
  Total?: number;
  createdAt?: string;
  CreatedAt?: string;
  orderDate?: string;
  OrderDate?: string;
  items?: TicimaxOrderLine[];
  Items?: TicimaxOrderLine[];
  orderItems?: TicimaxOrderLine[];
  OrderItems?: TicimaxOrderLine[];
}

export interface TicimaxProduct {
  id?: string | number;
  Id?: string | number;
  productCode?: string;
  ProductCode?: string;
  code?: string;
  Code?: string;
  barcode?: string;
  Barcode?: string;
  name?: string;
  Name?: string;
  productName?: string;
  ProductName?: string;
  title?: string;
  stock?: number;
  Stock?: number;
  stockAmount?: number;
  StockAmount?: number;
  price?: number;
  Price?: number;
  salePrice?: number;
  SalePrice?: number;
  listPrice?: number;
  ListPrice?: number;
  isActive?: boolean;
  IsActive?: boolean;
  status?: string | number;
}

export interface TicimaxWebhookPayload {
  type: string;
  url: string;
}

export interface TicimaxCargoPayload {
  cargoCode: string;
  trackingNo: string;
}
