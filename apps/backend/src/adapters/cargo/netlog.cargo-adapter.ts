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
  requireStringField,
  singleEventFromText,
} from './cargo-adapter.helpers';

const DEFAULT_BASE = 'https://api.netlog.com.tr/v1';

export class NetlogCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(NetlogCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_BASE;
  }

  private headers(): Record<string, string> {
    const apiKey = requireStringField(this.creds, 'apiKey');
    const headerName =
      typeof this.creds.apiKeyHeader === 'string' && this.creds.apiKeyHeader.length > 0
        ? this.creds.apiKeyHeader
        : 'X-API-Key';
    return {
      'Content-Type': 'application/json',
      [headerName]: apiKey,
    };
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const path =
      typeof this.creds.createPath === 'string' && this.creds.createPath.length > 0
        ? this.creds.createPath.replace(/^\//, '')
        : 'shipments';

    const body = {
      referenceCode: params.orderId,
      receiver: {
        name: params.receiverName,
        phone: params.receiverPhone,
        address: params.receiverAddress,
        city: params.receiverCity,
        district: params.receiverDistrict,
      },
      weight: params.weight,
      desi: params.desi ?? params.weight,
      note: params.notes ?? '',
    };

    const { data, status } = await axios.post<unknown>(
      `${this.baseUrl()}/${path}`,
      body,
      { headers: this.headers(), timeout: 45_000, validateStatus: () => true },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('Netlog create HTTP hata', { status });
      throw new BadGatewayException('Netlog gönderi oluşturma başarısız');
    }
    const code = extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException('Netlog yanıtında takip numarası bulunamadı');
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const pathTpl =
      typeof this.creds.trackPath === 'string' && this.creds.trackPath.length > 0
        ? this.creds.trackPath.replace(/^\//, '')
        : 'shipments/{trackingNo}/track';
    const path = pathTpl.replace('{trackingNo}', encodeURIComponent(trackingCode));

    const { data, status } = await axios.get<unknown>(`${this.baseUrl()}/${path}`, {
      headers: this.headers(),
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('Netlog takip sorgusu başarısız');
    }
    const raw = JSON.stringify(data);
    return {
      trackingCode,
      status: normalizeTrackingStatus(raw),
      lastUpdate: new Date(),
      events: singleEventFromText(trackingCode, raw),
    };
  }

  async getRates(_params: RateParams): Promise<CargoRate[]> {
    return [];
  }

  async cancelShipment(_trackingCode: string): Promise<void> {
    return;
  }

  async getLabel(_trackingCode: string): Promise<Buffer | null> {
    return null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl()}/health`, {
        headers: this.headers(),
        timeout: 15_000,
        validateStatus: () => true,
      });
      return true;
    } catch {
      return false;
    }
  }
}
