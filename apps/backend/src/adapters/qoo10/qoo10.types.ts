export interface Qoo10ApiEnvelope {
  ResultCode?: number | string;
  ResultMsg?: string;
  ResultObject?: unknown;
}

export interface Qoo10ShippingRow {
  OrderNo?: string | number;
  PackNo?: string | number;
  Buyer?: string;
  BuyerName?: string;
  BuyerTel?: string;
  OrderDate?: string;
  PaymentDate?: string;
  ShippingStatus?: string;
  ItemCode?: string;
  ItemTitle?: string;
  OptionCode?: string;
  OrderPrice?: number | string;
  OrderQty?: number | string;
  Total?: number | string;
  Currency?: string;
}

export interface Qoo10GoodsRow {
  ItemCode?: string;
  ItemTitle?: string;
  SellerCode?: string;
  ItemPrice?: number | string;
  SellerPrice?: number | string;
  StockQty?: number | string;
  ItemQty?: number | string;
  OptionCode?: string;
}

export interface Qoo10OrderRow {
  OrderNo?: string | number;
  OrderId?: string | number;
  PackNo?: string | number;
  Buyer?: string;
  BuyerName?: string;
  BuyerNm?: string;
  OrderDate?: string;
  OrderStatus?: string;
  ItemCode?: string;
  ItemTitle?: string;
  ItemNm?: string;
  OrderQty?: number | string;
  ItemQty?: number | string;
  OrderPrice?: number | string;
  SellerPrice?: number | string;
  Total?: number | string;
  Currency?: string;
}
