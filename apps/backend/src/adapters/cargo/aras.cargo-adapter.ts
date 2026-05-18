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

const BASE =
  'https://customerservice.araskargo.com.tr/ArasCargoCustomerService/';

export class ArasCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(ArasCargoAdapter.name);
  private sessionToken: string | null = null;

  constructor(private readonly creds: Record<string, unknown>) {}

  private async ensureSession(): Promise<string> {
    if (this.sessionToken) {
      return this.sessionToken;
    }
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const loginPath =
      typeof this.creds.loginPath === 'string' && this.creds.loginPath.length > 0
        ? this.creds.loginPath
        : 'api/ArasLogin/Login';

    const { data, status } = await axios.post<unknown>(
      `${BASE.replace(/\/$/, '')}/${loginPath.replace(/^\//, '')}`,
      { UserName: username, Password: password },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('Aras Kargo oturum açma başarısız');
    }
    const token =
      extractTrackingCodeFromPayload(data) ??
      getTokenFromArasLogin(data);
    if (!token) {
      throw new BadGatewayException('Aras Kargo oturum anahtarı alınamadı');
    }
    this.sessionToken = token;
    return token;
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const token = await this.ensureSession();
    const path =
      typeof this.creds.createShipmentPath === 'string' &&
      this.creds.createShipmentPath.length > 0
        ? this.creds.createShipmentPath
        : 'api/Shipment/Save';

    const body = {
      OrderId: params.orderId,
      ReceiverName: params.receiverName,
      ReceiverPhone: params.receiverPhone,
      ReceiverAddress: params.receiverAddress,
      ReceiverCityName: params.receiverCity,
      ReceiverTownName: params.receiverDistrict,
      Weight: params.weight,
      Desi: params.desi ?? params.weight,
      Description: params.notes ?? '',
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
    const token = await this.ensureSession();
    const path =
      typeof this.creds.trackShipmentPath === 'string' &&
      this.creds.trackShipmentPath.length > 0
        ? this.creds.trackShipmentPath
        : 'api/Shipment/Tracking';

    const { data, status } = await axios.get<unknown>(
      `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      {
        params: { barcode: trackingCode, Barcode: trackingCode },
        headers: { Authorization: `Bearer ${token}` },
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
    const token = await this.ensureSession();
    const path =
      typeof this.creds.cancelShipmentPath === 'string' &&
      this.creds.cancelShipmentPath.length > 0
        ? this.creds.cancelShipmentPath
        : 'api/Shipment/Cancel';

    const { status } = await axios.post(
      `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      { Barcode: trackingCode, barcode: trackingCode },
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
      throw new BadGatewayException('Aras Kargo iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<string | null> {
    void trackingCode;
    return null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureSession();
      return true;
    } catch {
      return false;
    }
  }
}

function getTokenFromArasLogin(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const r = data as Record<string, unknown>;
  const candidates = [
    r.Token,
    r.token,
    r.SessionToken,
    r.sessionToken,
    r.Data,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 8) {
      return c;
    }
    if (typeof c === 'object' && c !== null && 'Token' in c) {
      const t = (c as { Token?: unknown }).Token;
      if (typeof t === 'string' && t.length > 8) {
        return t;
      }
    }
  }
  return undefined;
}
