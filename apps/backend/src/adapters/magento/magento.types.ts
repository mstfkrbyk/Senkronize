/** Magento 2 REST — sipariş kalemi (kısmi şema) */
export interface MagentoOrderItem {
  sku?: string;
  name?: string;
  qty_ordered?: number;
  price?: number;
  item_id?: number;
}

/** Magento 2 REST — sipariş */
export interface MagentoOrder {
  entity_id?: number;
  increment_id?: string;
  status?: string;
  customer_firstname?: string;
  customer_lastname?: string;
  created_at?: string;
  grand_total?: number;
  order_currency_code?: string;
  items?: MagentoOrderItem[];
}

export interface MagentoOrdersEnvelope {
  items?: MagentoOrder[];
}

/** Ürün + stok */
export interface MagentoProduct {
  id?: number;
  sku?: string;
  name?: string;
  price?: number;
  status?: number;
  extension_attributes?: {
    stock_item?: {
      item_id?: number;
      qty?: number;
      is_in_stock?: boolean;
    };
  };
}

export interface MagentoProductsEnvelope {
  items?: MagentoProduct[];
}
