export interface TemuApiEnvelope<T = unknown> {
  success?: boolean;
  result?: T;
  error_msg?: string;
}

export interface TemuOrderLine {
  sku_id?: string;
  quantity?: number;
  sale_price?: number;
  goods_name?: string;
}

export interface TemuOrder {
  order_sn?: string;
  order_status?: string;
  receiver_name?: string;
  order_amount?: number;
  currency?: string;
  create_time?: number;
  item_list?: TemuOrderLine[];
}
