export interface MercadolibreTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
}

export interface MercadolibreOrderItem {
  item?: { id?: string; title?: string };
  quantity?: number;
  unit_price?: number;
  full_unit_price?: number;
}

export interface MercadolibreOrder {
  id?: number | string;
  status?: string;
  date_created?: string;
  buyer?: { nickname?: string; first_name?: string; last_name?: string };
  order_items?: MercadolibreOrderItem[];
  total_amount?: number;
  currency_id?: string;
  shipping?: { id?: number | string };
}

export interface MercadolibreOrdersSearchResponse {
  results?: MercadolibreOrder[];
  paging?: { total?: number; offset?: number; limit?: number };
}

export interface MercadolibreShipment {
  id?: number | string;
  status?: string;
  tracking_number?: string;
  tracking_method?: string;
}

export interface MercadolibreItemSearchHit {
  id?: string;
  title?: string;
  price?: number;
  currency_id?: string;
  available_quantity?: number;
  status?: string;
  thumbnail?: string;
}

export interface MercadolibreItemsSearchResponse {
  results?: string[];
  paging?: { total?: number; offset?: number; limit?: number };
}

export interface MercadolibreFulfillmentPayload {
  shipmentId: string;
  orderItemIds: string[];
}
