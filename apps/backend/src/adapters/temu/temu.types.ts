export interface TemuGoodsIds {
  goodsId: string;
  skuId: string;
}

export interface TemuOrderLine {
  sku_id?: string;
  goods_id?: string;
  quantity?: number;
  sale_price?: number;
  price?: number;
  goods_name?: string;
}

export interface TemuOrder {
  order_id?: string | number;
  order_sn?: string;
  order_status?: string;
  receiver_name?: string;
  order_amount?: number;
  currency?: string;
  create_time?: number;
  item_list?: TemuOrderLine[];
}

export interface TemuShipPayload {
  order_id: string;
  tracking_number: string;
  logistics_channel_code: string;
}
