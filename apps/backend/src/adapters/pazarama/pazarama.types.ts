export interface PazaramaTokenResponse {
  accessToken?: string;
  access_token?: string;
  expiresIn?: number;
  expires_in?: number;
}

export interface PazaramaShipmentPayload {
  orderNumber: string;
  cargoCode: string;
  trackingNumber: string;
}

export interface PazaramaStockItem {
  productCode: string;
  quantity: number;
}

export interface PazaramaPriceItem {
  productCode: string;
  salePrice: number;
  listPrice: number;
}
