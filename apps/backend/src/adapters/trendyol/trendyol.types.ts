export interface TrendyolShipmentAddress {
  firstName: string;
  lastName: string;
  fullAddress?: string;
  city?: string;
  district?: string;
  phone?: string;
  phoneNumber?: string;
}

export interface TrendyolOrderLine {
  quantity: number;
  productName: string;
  barcode: string;
  merchantSku?: string;
  price: number;
  id?: number;
}

export interface TrendyolOrder {
  shipmentAddress: TrendyolShipmentAddress;
  orderNumber: string;
  totalPrice?: number;
  grossAmount?: number;
  lines: TrendyolOrderLine[];
  orderDate: number;
  currencyCode?: string;
  id?: number;
  cargoTrackingNumber?: string;
  cargoProviderName?: string;
  status: string;
}

export interface TrendyolOrdersResponse {
  content?: TrendyolOrder[];
  orders?: TrendyolOrder[];
  totalElements?: number;
  totalCount?: number;
  totalPages?: number;
  page?: number;
  size?: number;
}

export interface TrendyolProduct {
  id: string;
  approved: boolean;
  barcode: string;
  title: string;
  productMainId?: string;
  brandId?: number;
  brandName?: string;
  stockUnitType?: string;
  quantity: number;
  listPrice: number;
  salePrice: number;
  vatRate?: number;
  images: Array<{ url: string }>;
}

export interface TrendyolProductsResponse {
  content?: TrendyolProduct[];
  products?: TrendyolProduct[];
  totalElements?: number;
  totalCount?: number;
  totalPages?: number;
  page?: number;
  size?: number;
}

export interface TrendyolPriceInventoryItem {
  barcode: string;
  quantity?: number;
  salePrice?: number;
  listPrice?: number;
}

export type TrendyolShipmentPackageStatus =
  | 'Picking'
  | 'Invoiced'
  | 'Shipped'
  | 'Delivered'
  | 'Returned';

export interface TrendyolPackageLine {
  lineId: number;
  quantity: number;
}

export interface TrendyolCreatePackageBody {
  lines: TrendyolPackageLine[];
  cargoProvider: string;
  shipmentTrackingNumber?: string;
}
