export type POStatus =
  | 'DRAFT'
  | 'SENT'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface SupplierDto {
  id: string;
  organizationId: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  orderCount?: number;
  totalSpend?: string;
}

export interface PurchaseOrderItemDto {
  id: string;
  purchaseOrderId: string;
  barcode: string;
  productName: string;
  quantity: number;
  orderedQty: number;
  receivedQty: number;
  unitCost: string;
  totalCost: string;
}

export interface PurchaseOrderDetailDto {
  id: string;
  organizationId: string;
  supplierId: string;
  orderNumber: string;
  status: POStatus;
  totalAmount: string;
  currency: string;
  expectedDate: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: SupplierDto;
  items: PurchaseOrderItemDto[];
}

export interface ReplenishmentSuggestionDto {
  barcode: string;
  productName: string;
  currentQuantity: number;
  suggestedOrderQuantity: number;
  message: string;
}
