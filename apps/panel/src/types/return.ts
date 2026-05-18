/** Backend `ReturnStatus` ile uyumlu */
export type ReturnStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'REFUNDED'
  | 'REJECTED'
  | 'COMPLETED';

export interface ReturnListItem {
  id: string;
  organizationId: string;
  orderId: string;
  platform: string;
  platformReturnId: string | null;
  status: ReturnStatus;
  reason: string | null;
  refundAmount: string | null;
  refundStatus: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    platformOrderId: string;
    customerName: string;
    totalAmount: string;
    currency: string;
  };
  items: Array<{
    id: string;
    barcode: string;
    quantity: number;
    reason: string | null;
    condition: string | null;
    productName: string | null;
    thumbnailUrl: string | null;
  }>;
}

export interface ReturnDetail extends ReturnListItem {
  statusLog: Array<{ at: string; status: string; note?: string }>;
  order: ReturnListItem['order'] & {
    shippingAddress: string | null;
    customerPhone: string | null;
    platformCreatedAt: string;
    status: string;
    items: Array<{
      barcode: string;
      productName: string | null;
      sku: string;
      quantity: number;
    }>;
  };
}
