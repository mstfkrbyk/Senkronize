import type { ErpProduct } from '@senkronize/shared';

export interface ErpOrder {
  erpOrderId: string;
  orderRef: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export interface ErpInventoryPushItem {
  erpProductId: string;
  quantity: number;
}

export type FetchInventoryFn = (
  credentials: Record<string, string>,
) => Promise<ErpProduct[]>;

export type PushInventoryFn = (
  credentials: Record<string, string>,
  items: ErpInventoryPushItem[],
) => Promise<void>;

export type FetchOrdersFn = (
  credentials: Record<string, string>,
  since?: Date,
) => Promise<ErpOrder[]>;
