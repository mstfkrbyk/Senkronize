import type { CargoProvider } from '@senkronize/shared';

export type CargoTrackingStatus =
  | 'CREATED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED';

export interface CargoTrackingEvent {
  timestamp: string;
  status: string;
  description: string;
  location?: string;
}

export interface CargoTrackingResult {
  trackingCode: string;
  status: CargoTrackingStatus;
  lastUpdate: string;
  location?: string;
  events: CargoTrackingEvent[];
}

export interface CargoPriceQuote {
  provider: string;
  price: number;
  currency: string;
  estimatedDays?: number;
  serviceName: string;
  connectionId?: string;
  providerLabel?: string;
}

export interface UnifiedCargoConnection {
  id: string;
  provider: string;
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown' | 'inactive';
  lastSyncAt: string | null;
}

export interface CargoConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface BulkShipOrderRow {
  orderId: string;
  platformOrderId: string;
  customerName: string;
  trackingNumber: string;
}

export interface BulkShipSubmitItem {
  orderId: string;
  cargoProvider: CargoProvider;
  trackingNumber?: string;
}
