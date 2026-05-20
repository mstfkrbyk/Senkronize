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
  StockQty?: number | string;
  OptionCode?: string;
}
