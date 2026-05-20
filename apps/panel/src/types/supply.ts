export type POStatus =
  | 'DRAFT'
  | 'SENT'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface SupplierContactDto {
  id: string;
  organizationId: string;
  supplierId: string;
  subject: string | null;
  notes: string;
  contactMethod: string | null;
  createdAt: string;
}

export interface SupplierDto {
  id: string;
  organizationId: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  taxNumber: string | null;
  paymentTerms: string | null;
  currency: string;
  leadTimeDays: number | null;
  rating: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  orderCount?: number;
  totalSpend?: string;
  lastOrderAt?: string | null;
  contacts?: SupplierContactDto[];
}

export interface SupplierPerformanceDto {
  avgDeliveryDays: number | null;
  orderCount: number;
  totalSpend: string;
  rating: number | null;
  orderHistory: Array<{
    id: string;
    orderNumber: string;
    status: POStatus;
    totalAmount: string;
    currency: string;
    createdAt: string;
    receivedAt: string | null;
    expectedDate: string | null;
  }>;
}

export interface PurchaseOrderItemDto {
  id: string;
  purchaseOrderId: string;
  productId: string | null;
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
  sentAt: string | null;
  confirmedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: SupplierDto;
  items: PurchaseOrderItemDto[];
}

export interface PurchaseOrderAnalyticsDto {
  totalOrders: number;
  totalAmount: number;
  pendingOrders: number;
  avgLeadTime: number;
  topSuppliers: Array<{
    supplierId: string;
    name: string;
    orders: number;
    amount: number;
  }>;
  monthlySpend: Array<{ month: string; amount: number }>;
}

export interface ReplenishmentSuggestionDto {
  barcode: string;
  productName: string;
  currentQuantity: number;
  suggestedOrderQuantity: number;
  message: string;
}
