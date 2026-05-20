export interface RakutenOrderLine {
  itemNumber?: string;
  itemName?: string;
  units?: number;
  price?: number;
}

export interface RakutenOrderModel {
  orderNumber?: string;
  orderDatetime?: string;
  orderStatus?: string;
  ordererName?: string;
  PackageModelList?: Array<{ ItemModelList?: RakutenOrderLine[] }>;
  ItemModelList?: RakutenOrderLine[];
  totalPrice?: number;
}

export interface RakutenGetOrderResponse {
  OrderModelList?: RakutenOrderModel[];
}

export interface RakutenSearchOrderResponse {
  orderNumberList?: string[];
  OrderModelList?: RakutenOrderModel[];
}
