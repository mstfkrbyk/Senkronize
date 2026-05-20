export type OrderStatus =
  | 'NEW'
  | 'PICKING'
  | 'INVOICED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

export interface OrderItem {
  id: string;
  sku: string;
  barcode: string;
  productName: string | null;
  quantity: number;
  unitPrice: string;
  thumbnailUrl?: string | null;
}

export interface Order {
  id: string;
  platform: string;
  platformOrderId: string;
  status: OrderStatus;
  customerName: string;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  totalAmount: string;
  currency: string;
  cargoTrackingNumber: string | null;
  cargoProvider: string | null;
  platformCreatedAt: string;
  syncedAt: string;
  items: OrderItem[];
  cancellationRequestedAt?: string | null;
  cancellationRequestNote?: string | null;
}

export interface OrderNote {
  id: string;
  orderId: string;
  userId: string;
  userName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface BulkResult {
  success: number;
  failed: number;
  errors: { id: string; message: string }[];
}

export interface OrdersResponse {
  items: Order[];
  total: number;
}

export interface OrderSummaryDto {
  todayOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  byPlatform: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface OrderFilters {
  platform?: string;
  /** Virgülle birleştirilmiş platform kodları */
  platforms?: string;
  status?: string;
  /** Virgülle birleştirilmiş durum kodları */
  statuses?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  cargoProvider?: string;
  minTotal?: number;
  maxTotal?: number;
  page?: number;
  limit?: number;
}
