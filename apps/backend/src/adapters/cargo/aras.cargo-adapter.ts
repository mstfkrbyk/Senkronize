import { BadGatewayException, Logger } from '@nestjs/common';
import axios from 'axios';

import type {
  CargoRate,
  CreateShipmentParams,
  ICargoAdapter,
  RateParams,
  ShipmentResult,
  TrackingResult,
} from '../cargo-adapter.interface';
import {
  extractTrackingCodeFromPayload,
  normalizeTrackingStatus,
  optionalStringField,
  requireStringField,
  singleEventFromText,
} from './cargo-adapter.helpers';

const DEFAULT_BASE = 'https://customerapi.araskargo.com.tr';

export class ArasCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(ArasCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_BASE;
  }

  private customerCode(): string {
    return (
      optionalStringField(this.creds, 'customerCode') ??
      requireStringField(this.creds, 'username')
    );
  }

  private authBody(): { customerCode: string; password: string } {
    return {
      customerCode: this.customerCode(),
      password: requireStringField(this.creds, 'password'),
    };
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const auth = this.authBody();
    const senderName =
      optionalStringField(this.creds, 'senderName') ?? 'Senkronize';

    const body = {
      customerCode: auth.customerCode,
      password: auth.password,
      senderName,
      receiverName: params.receiverName,
      receiverAddress: params.receiverAddress,
      receiverCity: params.receiverCity,
      receiverDistrict: params.receiverDistrict,
      receiverPhone: params.receiverPhone,
      weight: params.weight,
      pieces: 1,
      desi: params.desi ?? params.weight,
      orderId: params.orderId,
      description: params.notes ?? '',
    };

    const { data, status } = await axios.post<unknown>(
      `${this.baseUrl()}/api/shipment/create`,
      body,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('Aras createShipment HTTP hata', { status });
      throw new BadGatewayException('Aras Kargo gönderi oluşturma başarısız');
    }
    const code = extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException('Aras Kargo yanıtında takip numarası bulunamadı');
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const auth = this.authBody();
    const { data, status } = await axios.get<unknown>(
      `${this.baseUrl()}/api/shipment/track`,
      {
        params: {
          barcode: trackingCode,
          customerCode: auth.customerCode,
          password: auth.password,
        },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('Aras Kargo takip sorgusu başarısız');
    }
    const raw =
      typeof data === 'object' && data !== null && 'status' in data
        ? String((data as { status: unknown }).status)
        : JSON.stringify(data);
    return {
      trackingCode,
      status: normalizeTrackingStatus(raw),
      lastUpdate: new Date(),
      events: singleEventFromText(trackingCode, raw),
    };
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    const auth = this.authBody();
    const { status } = await axios.post(
      `${this.baseUrl()}/api/shipment/cancel`,
      {
        barcode: trackingCode,
        customerCode: auth.customerCode,
        password: auth.password,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('Aras Kargo iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    void trackingCode;
    return null;
  }

  async getRates(_params: RateParams): Promise<CargoRate[]> {
    void _params;
    return [];
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.trackShipment('0000000000000');
      return true;
    } catch {
      return false;
    }
  }
}
