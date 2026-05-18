export interface KauflandOrderUnit {
  id_order_unit?: number;
  id_order?: number;
  status?: string;
  title?: string;
  price?: number | string;
  currency?: string;
  ts_created_iso?: string;
}

export interface KauflandOrderUnitsResponse {
  data?: KauflandOrderUnit[];
}

export interface KauflandInventoryItem {
  id_item?: number;
  ean?: string;
  title?: string;
  amount?: number;
  price?: number | string;
}

export interface KauflandInventoryResponse {
  data?: KauflandInventoryItem[];
}
