export interface RakutenOrderLine {
  itemNumber?: string;
  itemName?: string;
  units?: number;
  price?: number;
  itemPrice?: number;
}

export interface RakutenPackageModel {
  basketId?: string | number;
  Basketid?: string | number;
  ItemModelList?: RakutenOrderLine[];
  itemModelList?: RakutenOrderLine[];
}

export interface RakutenOrderModel {
  orderNumber?: string;
  orderDatetime?: string;
  orderStatus?: string;
  orderProgress?: number | string;
  ordererName?: string;
  OrdererModel?: { ordererName?: string; name?: string };
  PackageModelList?: RakutenPackageModel[];
  packageModelList?: RakutenPackageModel[];
  ItemModelList?: RakutenOrderLine[];
  itemModelList?: RakutenOrderLine[];
  totalPrice?: number;
  totalAmount?: number;
}

export interface RakutenGetOrderResponse {
  OrderModelList?: RakutenOrderModel[];
  orderModelList?: RakutenOrderModel[];
}

export interface RakutenSearchOrderResponse {
  orderNumberList?: string[];
  OrderNumberList?: string[];
  OrderModelList?: RakutenOrderModel[];
  orderModelList?: RakutenOrderModel[];
  PaginationResponseModel?: {
    requestPage?: number;
    totalPages?: number;
  };
  paginationResponseModel?: {
    requestPage?: number;
    totalPages?: number;
  };
}
