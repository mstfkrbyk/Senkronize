export interface SahibindenListing {
  id?: string | number;
  title?: string;
  stock?: number;
  price?: number;
  status?: string;
  sku?: string;
}

export interface SahibindenOrderLine {
  listing_id?: string | number;
  title?: string;
  quantity?: number;
  price?: number;
}

export interface SahibindenOrder {
  id?: string | number;
  status?: string;
  buyer?: string;
  total?: number;
  currency?: string;
  created_at?: string;
  lines?: SahibindenOrderLine[];
}
