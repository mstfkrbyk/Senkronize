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

const DEFAULT_BASE = 'https://ecommerce.ptt.gov.tr/api';

export class PttKargoCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(PttKargoCargoAdapter.name);
  private bearer: string | null = null;

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_BASE;
  }

  private async ensureToken(): Promise<string> {
    if (this.bearer) {
      return this.bearer;
    }
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const loginPath =
      typeof this.creds.loginPath === 'string' && this.creds.loginPath.length > 0
        ? this.creds.loginPath.replace(/^\//, '')
        : 'auth/login';

    const { data, status } = await axios.post<unknown>(
      `${this.baseUrl()}/${loginPath}`,
      { username, password },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('PTT Kargo kimlik doğrulama başarısız');
    }
    const token = extractBearer(data);
    if (!token) {
      throw new BadGatewayException('PTT Kargo oturum anahtarı alınamadı');
    }
    this.bearer = token;
    return token;
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const token = await this.ensureToken();
    const path =
      typeof this.creds.createShipmentPath === 'string' &&
      this.creds.createShipmentPath.length > 0
        ? this.creds.createShipmentPath.replace(/^\//, '')
        : 'cargo/create';

    const body = {
      referenceNo: params.orderId,
      receiverName: params.receiverName,
      receiverPhone: params.receiverPhone,
      receiverAddress: params.receiverAddress,
      receiverCity: params.receiverCity,
      receiverDistrict: params.receiverDistrict,
      weight: params.weight,
      desi: params.desi ?? params.weight,
      note: params.notes ?? '',
    };

    const { data, status } = await axios.post<unknown>(
      `${this.baseUrl()}/${path}`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('PTT Kargo create HTTP hata', { status });
      throw new BadGatewayException('PTT Kargo gönderi oluşturma başarısız');
    }
    const code = extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException('PTT Kargo yanıtında takip numarası bulunamadı');
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const token = await this.ensureToken();
    const pathTpl =
      typeof this.creds.trackShipmentPath === 'string' &&
      this.creds.trackShipmentPath.length > 0
        ? this.creds.trackShipmentPath.replace(/^\//, '')
        : 'cargo/track/{barcode}';
    const path = pathTpl.replace('{barcode}', encodeURIComponent(trackingCode));

    const { data, status } = await axios.get<unknown>(`${this.baseUrl()}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('PTT Kargo takip sorgusu başarısız');
    }
    const raw = JSON.stringify(data);
    return {
      trackingCode,
      status: normalizeTrackingStatus(raw),
      lastUpdate: new Date(),
      events: singleEventFromText(trackingCode, raw),
    };
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    void trackingCode;
    throw new BadGatewayException('PTT e-ticaret iptali bu adaptörde desteklenmiyor');
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    try {
      const token = await this.ensureToken();
      const path =
        typeof this.creds.labelPath === 'string' && this.creds.labelPath.length > 0
          ? this.creds.labelPath.replace(/^\//, '')
          : 'cargo/label';
      const { data, status, headers } = await axios.post<ArrayBuffer>(
        `${this.baseUrl()}/${path}`,
        { barcode: trackingCode, trackingNumber: trackingCode },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          responseType: 'arraybuffer',
          timeout: 45_000,
          validateStatus: () => true,
        },
      );
      if (status >= 200 && status < 300 && data) {
        const ct = String(headers['content-type'] ?? '');
        if (ct.includes('pdf') || ct.includes('octet-stream')) {
          return Buffer.from(new Uint8Array(data));
        }
      }
    } catch (error) {
      this.logger.warn('PTT etiket alınamadı', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
    return null;
  }

  async getRates(_params: RateParams): Promise<CargoRate[]> {
    void _params;
    return [];
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureToken();
      return true;
    } catch {
      return false;
    }
  }
}

function extractBearer(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const r = data as Record<string, unknown>;
  const t = r.access_token ?? r.accessToken ?? r.token ?? r.Token ?? r.data;
  if (typeof t === 'string' && t.length > 10) {
    return t;
  }
  if (typeof t === 'object' && t !== null && 'token' in t) {
    const inner = (t as { token?: unknown }).token;
    if (typeof inner === 'string' && inner.length > 10) {
      return inner;
    }
  }
  return undefined;
}
