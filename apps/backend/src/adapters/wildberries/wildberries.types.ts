export interface WildberriesOrder {
  id?: number;
  orderId?: string;
  createdAt?: string;
  article?: string;
  skus?: string[];
  convertedPrice?: number;
  currencyCode?: string;
  supplierStatus?: string;
}

export interface WildberriesOrdersResponse {
  orders?: WildberriesOrder[];
  next?: number;
}

export interface WildberriesStockItem {
  sku: string;
  amount: number;
}

export interface WildberriesCardPriceUpdate {
  nmID: number;
  price: number;
}
