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

const DEFAULT_BASE = 'https://api.horozlojistik.com/v1';

export class HorozCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(HorozCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_BASE;
  }

  private authConfig(): { auth: { username: string; password: string } } {
    return {
      auth: {
        username: requireStringField(this.creds, 'username'),
        password: requireStringField(this.creds, 'password'),
      },
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
      {
        headers: { 'Content-Type': 'application/json' },
        ...this.authConfig(),
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('Horoz create HTTP hata', { status });
      throw new BadGatewayException('Horoz Lojistik gönderi oluşturma başarısız');
    }
    const code = extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException(
        'Horoz Lojistik yanıtında takip numarası bulunamadı',
      );
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
      headers: { 'Content-Type': 'application/json' },
      ...this.authConfig(),
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('Horoz Lojistik takip sorgusu başarısız');
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
        ...this.authConfig(),
        timeout: 15_000,
        validateStatus: () => true,
      });
      return true;
    } catch {
      return false;
    }
  }
}
