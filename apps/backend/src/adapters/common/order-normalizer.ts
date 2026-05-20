import { OrderStatus } from '@prisma/client';
import type { MarketplaceOrder } from '@senkronize/shared';

export interface NormalizedAddress {
  fullAddress: string;
  city?: string;
  district?: string;
}

export interface NormalizedOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
}

export interface NormalizedOrder {
  platformOrderId: string;
  /** Pazaryeri ham durum metni (DB eşlemesi için) */
  rawStatus: string;
  status: OrderStatus;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  currency: string;
  cargoProvider?: string;
  trackingNumber?: string;
  items: NormalizedOrderItem[];
  shippingAddress: NormalizedAddress;
  platformCreatedAt: Date;
}

const TRENDYOL_STATUS_MAP: Record<string, OrderStatus> = {
  Created: OrderStatus.NEW,
  Picking: OrderStatus.PICKING,
  Invoiced: OrderStatus.INVOICED,
  Shipped: OrderStatus.SHIPPED,
  Cancelled: OrderStatus.CANCELLED,
  Delivered: OrderStatus.DELIVERED,
  UnDelivered: OrderStatus.RETURNED,
  Returned: OrderStatus.RETURNED,
};

const HEPSIBURADA_STATUS_MAP: Record<string, OrderStatus> = {
  WaitingForPacking: OrderStatus.NEW,
  Packing: OrderStatus.PICKING,
  Shipped: OrderStatus.SHIPPED,
  Delivered: OrderStatus.DELIVERED,
  Cancelled: OrderStatus.CANCELLED,
  Returned: OrderStatus.RETURNED,
};

const N11_STATUS_MAP: Record<string, OrderStatus> = {
  New: OrderStatus.NEW,
  Approved: OrderStatus.NEW,
  Shipped: OrderStatus.SHIPPED,
  Delivered: OrderStatus.DELIVERED,
  Cancelled: OrderStatus.CANCELLED,
  Completed: OrderStatus.DELIVERED,
};

export function mapTrendyolStatus(status: string): OrderStatus {
  return TRENDYOL_STATUS_MAP[status.trim()] ?? OrderStatus.NEW;
}

export function mapHepsiburadaStatus(status: string): OrderStatus {
  const key = status.trim();
  return (
    HEPSIBURADA_STATUS_MAP[key] ??
    HEPSIBURADA_STATUS_MAP[key.replace(/\s+/g, '')] ??
    OrderStatus.NEW
  );
}

export function mapN11Status(status: string): OrderStatus {
  return N11_STATUS_MAP[status.trim()] ?? OrderStatus.NEW;
}

export function toMarketplaceOrder(order: NormalizedOrder): MarketplaceOrder {
  return {
    platformOrderId: order.platformOrderId,
    status: order.rawStatus,
    customerName: order.customerName,
    items: order.items.map((item, index) => ({
      sku: item.sku,
      barcode: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      platformItemId: `${order.platformOrderId}:${String(index)}`,
      productName: item.name,
    })),
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.platformCreatedAt.toISOString(),
    cargoTrackingNumber: order.trackingNumber,
    cargoProvider: order.cargoProvider,
  };
}
