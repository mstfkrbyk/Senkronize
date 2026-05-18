export interface GratisOrderLine {
  sku?: string;
  barcode?: string;
  quantity?: number;
  price?: number;
  name?: string;
  line_id?: string | number;
}

export interface GratisOrder {
  id?: string | number;
  status?: string;
  customer?: string;
  customer_name?: string;
  total?: number;
  currency?: string;
  created_at?: string;
  lines?: GratisOrderLine[];
  items?: GratisOrderLine[];
}

export interface GratisProduct {
  id?: string | number;
  barcode?: string;
  sku?: string;
  title?: string;
  stock?: number;
  sale_price?: number;
  list_price?: number;
  active?: boolean;
}
