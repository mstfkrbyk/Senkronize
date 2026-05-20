import { EcommerceType, Marketplace, OrderStatus } from '@prisma/client';
import type { MarketplaceOrder } from '@senkronize/shared';

export interface NormalizedOrderItem {
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  imageUrl?: string;
}

export interface NormalizedOrderCustomer {
  name: string;
  email: string;
  phone?: string;
}

export interface NormalizedOrderAddress {
  line1: string;
  city: string;
  country: string;
}

export interface NormalizedOrder {
  externalId: string;
  externalOrderNo: string;
  platform: Marketplace | EcommerceType;
  /** Pazaryeri ham durum metni (DB eşlemesi için) */
  rawStatus?: string;
  status: OrderStatus;
  customer: NormalizedOrderCustomer;
  shippingAddress: NormalizedOrderAddress;
  items: NormalizedOrderItem[];
  totalAmount: number;
  currency: string;
  createdAt: Date;
  trackingNumber?: string;
  cargoProvider?: string;
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

const WOOCOMMERCE_STATUS_MAP: Record<string, OrderStatus> = {
  pending: OrderStatus.NEW,
  processing: OrderStatus.PICKING,
  'on-hold': OrderStatus.NEW,
  completed: OrderStatus.DELIVERED,
  cancelled: OrderStatus.CANCELLED,
  refunded: OrderStatus.RETURNED,
  failed: OrderStatus.CANCELLED,
  trash: OrderStatus.CANCELLED,
};

const TICIMAX_STATUS_MAP: Record<string, OrderStatus> = {
  '0': OrderStatus.NEW,
  '1': OrderStatus.NEW,
  '2': OrderStatus.PICKING,
  '3': OrderStatus.INVOICED,
  '4': OrderStatus.SHIPPED,
  '5': OrderStatus.DELIVERED,
  '6': OrderStatus.CANCELLED,
  NEW: OrderStatus.NEW,
  PICKING: OrderStatus.PICKING,
  SHIPPED: OrderStatus.SHIPPED,
  DELIVERED: OrderStatus.DELIVERED,
  CANCELLED: OrderStatus.CANCELLED,
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

export function mapWooCommerceStatus(status: string): OrderStatus {
  const key = status.trim().toLowerCase();
  return WOOCOMMERCE_STATUS_MAP[key] ?? OrderStatus.NEW;
}

export function mapTicimaxStatus(status: string | number): OrderStatus {
  const key = String(status).trim();
  const upper = key.toUpperCase();
  return (
    TICIMAX_STATUS_MAP[key] ??
    TICIMAX_STATUS_MAP[upper] ??
    OrderStatus.NEW
  );
}

export function mapIdeasoftStatus(status: string | number): OrderStatus {
  const key = String(status).trim();
  if (key === '1' || key === '2') {
    return OrderStatus.NEW;
  }
  if (key === '3' || key === '4') {
    return OrderStatus.PICKING;
  }
  if (key === '5' || key === '6') {
    return OrderStatus.SHIPPED;
  }
  if (key === '7') {
    return OrderStatus.DELIVERED;
  }
  if (key === '8' || key === '9') {
    return OrderStatus.CANCELLED;
  }
  return OrderStatus.NEW;
}

export function mapShopifyStatus(
  financialStatus: string,
  fulfillmentStatus?: string | null,
): OrderStatus {
  const financial = financialStatus.trim().toLowerCase();
  const fulfillment = (fulfillmentStatus ?? '').trim().toLowerCase();
  if (financial === 'refunded' || financial === 'voided') {
    return OrderStatus.CANCELLED;
  }
  if (fulfillment === 'fulfilled') {
    return OrderStatus.DELIVERED;
  }
  if (fulfillment === 'partial') {
    return OrderStatus.SHIPPED;
  }
  if (financial === 'paid' || financial === 'partially_paid') {
    return OrderStatus.PICKING;
  }
  if (financial === 'pending') {
    return OrderStatus.NEW;
  }
  return OrderStatus.NEW;
}

export function toMarketplaceOrder(order: NormalizedOrder): MarketplaceOrder {
  return {
    platformOrderId: order.externalId,
    status: order.rawStatus ?? String(order.status),
    customerName: order.customer.name,
    items: order.items.map((item, index) => ({
      sku: item.sku,
      barcode: item.sku,
      quantity: item.qty,
      unitPrice: item.unitPrice,
      platformItemId: `${order.externalId}:${String(index)}`,
      productName: item.name,
    })),
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    cargoTrackingNumber: order.trackingNumber,
    cargoProvider: order.cargoProvider,
  };
}
