export interface MorhipoOrderLine {
  sku?: string;
  barcode?: string;
  qty?: number;
  quantity?: number;
  price?: number;
  title?: string;
  id?: string | number;
}

export interface MorhipoOrder {
  id?: string | number;
  campaign_id?: string | number;
  status?: string;
  buyer?: string;
  total?: number;
  currency?: string;
  created_at?: string;
  lines?: MorhipoOrderLine[];
}

export interface MorhipoListing {
  id?: string | number;
  sku?: string;
  barcode?: string;
  title?: string;
  stock?: number;
  price?: number;
  list_price?: number;
}
