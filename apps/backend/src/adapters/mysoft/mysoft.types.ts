export interface MysoftLoginResponse {
  accessToken?: string;
  token?: string;
  expires_in?: number;
}

export interface MysoftProductRow {
  id?: string;
  code?: string;
  barcode?: string;
  name?: string;
  stock?: number;
  quantity?: number;
}

export interface MysoftProductsResponse {
  items?: MysoftProductRow[];
  products?: MysoftProductRow[];
}
