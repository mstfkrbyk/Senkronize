export interface ICargoAdapter {
  createShipment(params: CreateShipmentParams): Promise<ShipmentResult>;
  trackShipment(trackingCode: string): Promise<TrackingResult>;
  cancelShipment(trackingCode: string): Promise<void>;
  getLabel(trackingCode: string): Promise<string | null>;
  testConnection(): Promise<boolean>;
}

export interface CreateShipmentParams {
  orderId: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverCity: string;
  receiverDistrict: string;
  weight: number;
  desi?: number;
  notes?: string;
}

export interface ShipmentResult {
  trackingCode: string;
  barcode?: string;
  labelUrl?: string;
  estimatedDelivery?: Date;
}

export type NormalizedTrackingStatus =
  | 'CREATED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED';

export interface TrackingResult {
  trackingCode: string;
  status: NormalizedTrackingStatus;
  lastUpdate: Date;
  location?: string;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  timestamp: Date;
  status: string;
  description: string;
  location?: string;
}
