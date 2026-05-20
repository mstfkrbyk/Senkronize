export interface JoomOrderLine {
  id?: string;
  sku?: string;
  productId?: string;
  variantId?: string;
  quantity?: number;
  price?: number;
  name?: string;
}

export interface JoomOrder {
  id?: string;
  orderId?: string;
  status?: string;
  customerName?: string;
  customer?: { name?: string };
  createdAt?: string;
  created_at?: string;
  total?: number;
  totalAmount?: number;
  currency?: string;
  items?: JoomOrderLine[];
  products?: JoomOrderLine[];
  trackingNumber?: string;
  carrierCode?: string;
}

export interface JoomProductVariant {
  id?: string;
  sku?: string;
  inventory?: { quantity?: number };
  price?: { value?: number; currency?: string };
}

export interface JoomProduct {
  id?: string;
  name?: string;
  variants?: JoomProductVariant[];
}
