export interface ICargoAdapter {
  createShipment(params: CreateShipmentParams): Promise<ShipmentResult>;
  trackShipment(trackingCode: string): Promise<TrackingResult>;
  cancelShipment(trackingCode: string): Promise<void>;
  /** PDF veya ham etiket baytları; yoksa null */
  getLabel(trackingCode: string): Promise<Buffer | null>;
  /** Fiyat teklifleri; desteklenmiyorsa boş dizi */
  getRates(params: RateParams): Promise<CargoRate[]>;
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

export interface RateParams {
  fromCountryCode: string;
  toCountryCode: string;
  fromPostalCode: string;
  toPostalCode: string;
  fromCity: string;
  toCity: string;
  weightKg: number;
  desi?: number;
}

export interface CargoRate {
  serviceCode?: string;
  serviceName: string;
  price: number;
  currency: string;
  transitDaysMin?: number;
  transitDaysMax?: number;
}

export interface CargoRateComparison {
  connectionId: string;
  provider: string;
  providerLabel: string;
  price: number;
  currency: string;
  serviceName: string;
  estimatedTransitDays?: number;
}
