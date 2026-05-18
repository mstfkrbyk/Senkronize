export interface DolapOrderLine {
  listing_id?: string | number;
  sku?: string;
  quantity?: number;
  price?: number;
  title?: string;
}

export interface DolapOrder {
  id?: string | number;
  status?: string;
  buyer_username?: string;
  total?: number;
  currency?: string;
  created_at?: string;
  lines?: DolapOrderLine[];
}

export interface DolapListing {
  id?: string | number;
  sku?: string;
  title?: string;
  stock?: number;
  price?: number;
  active?: boolean;
}
