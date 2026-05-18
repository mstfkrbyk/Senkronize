import { BadGatewayException, Logger } from '@nestjs/common';
import axios from 'axios';

import type {
  CreateShipmentParams,
  ICargoAdapter,
  ShipmentResult,
  TrackingResult,
} from '../cargo-adapter.interface';
import {
  extractTrackingCodeFromPayload,
  normalizeTrackingStatus,
  requireStringField,
  singleEventFromText,
} from './cargo-adapter.helpers';

const BASE = 'https://apikargo.ptt.gov.tr';

export class PttKargoCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(PttKargoCargoAdapter.name);
  private bearer: string | null = null;

  constructor(private readonly creds: Record<string, unknown>) {}

  private async ensureToken(): Promise<string> {
    if (this.bearer) {
      return this.bearer;
    }
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const loginPath =
      typeof this.creds.loginPath === 'string' && this.creds.loginPath.length > 0
        ? this.creds.loginPath
        : 'api/auth/token';

    const { data, status } = await axios.post<unknown>(
      `${BASE.replace(/\/$/, '')}/${loginPath.replace(/^\//, '')}`,
      { username, password, grant_type: 'password' },
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
        ? this.creds.createShipmentPath
        : 'api/shipment/create';

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
      `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
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
    const path =
      typeof this.creds.trackShipmentPath === 'string' &&
      this.creds.trackShipmentPath.length > 0
        ? this.creds.trackShipmentPath
        : 'api/shipment/track';

    const { data, status } = await axios.get<unknown>(
      `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      {
        params: { barcode: trackingCode, trackingNumber: trackingCode },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
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
    const token = await this.ensureToken();
    const path =
      typeof this.creds.cancelShipmentPath === 'string' &&
      this.creds.cancelShipmentPath.length > 0
        ? this.creds.cancelShipmentPath
        : 'api/shipment/cancel';

    const { status } = await axios.post(
      `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      { barcode: trackingCode },
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
      throw new BadGatewayException('PTT Kargo iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<string | null> {
    void trackingCode;
    return null;
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
  const t = r.access_token ?? r.accessToken ?? r.token ?? r.Token;
  if (typeof t === 'string' && t.length > 10) {
    return t;
  }
  return undefined;
}
