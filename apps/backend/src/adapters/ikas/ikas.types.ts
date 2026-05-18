/** İkas OAuth2 */
export interface IkasTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface IkasGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

export interface IkasListOrderData {
  listOrder?: {
    count?: number;
    data?: IkasOrderRow[];
    hasNext?: boolean;
    limit?: number;
    page?: number;
  };
}

export interface IkasOrderRow {
  id?: string;
  orderNumber?: string;
  orderedAt?: number;
  status?: string;
  totalFinalPrice?: number;
  currencyCode?: string;
}

export interface IkasListProductData {
  listProduct?: {
    count?: number;
    data?: IkasProductRow[];
    hasNext?: boolean;
    limit?: number;
    page?: number;
  };
}

export interface IkasProductRow {
  id?: string;
  name?: string;
  totalStock?: number;
  variants?: IkasVariantRow[];
}

export interface IkasVariantRow {
  id?: string;
  sku?: string;
  stockQuantity?: number;
}

export interface IkasListStockLocationData {
  listStockLocation?: Array<{ id?: string; name?: string }>;
}
