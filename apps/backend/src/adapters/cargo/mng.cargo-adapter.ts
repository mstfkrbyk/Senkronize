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

const BASE = 'https://ws.mngkargo.com.tr/mngkargo';

export class MngCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(MngCargoAdapter.name);
  private jwt: string | null = null;

  constructor(private readonly creds: Record<string, unknown>) {}

  private getCustomerCode(): string {
    if (typeof this.creds.customerCode === 'string' && this.creds.customerCode.length > 0) {
      return this.creds.customerCode;
    }
    if (typeof this.creds.customerId === 'string' && this.creds.customerId.length > 0) {
      return this.creds.customerId;
    }
    return requireStringField(this.creds, 'username');
  }

  private async ensureToken(): Promise<string> {
    if (this.jwt) {
      return this.jwt;
    }
    const customerCode = this.getCustomerCode();
    const password = requireStringField(this.creds, 'password');
    const authPath =
      typeof this.creds.authPath === 'string' && this.creds.authPath.length > 0
        ? this.creds.authPath
        : 'api/auth/login';

    const { data, status } = await axios.post<unknown>(
      `${BASE.replace(/\/$/, '')}/${authPath.replace(/^\//, '')}`,
      { customerCode, password, customerNumber: customerCode },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('MNG Kargo kimlik doğrulama başarısız');
    }
    const token = extractJwt(data);
    if (!token) {
      throw new BadGatewayException('MNG Kargo oturum anahtarı alınamadı');
    }
    this.jwt = token;
    return token;
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const token = await this.ensureToken();
    const path =
      typeof this.creds.createShipmentPath === 'string' &&
      this.creds.createShipmentPath.length > 0
        ? this.creds.createShipmentPath
        : 'api/cargo';

    const body = {
      referenceId: params.orderId,
      receiver: {
        name: params.receiverName,
        phone: params.receiverPhone,
        address: params.receiverAddress,
        city: params.receiverCity,
        district: params.receiverDistrict,
      },
      weight: params.weight,
      desi: params.desi ?? params.weight,
      contentDescription: params.notes ?? '',
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
      this.logger.warn('MNG createShipment HTTP hata', { status });
      throw new BadGatewayException('MNG Kargo gönderi oluşturma başarısız');
    }
    const code = extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException('MNG Kargo yanıtında takip numarası bulunamadı');
    }
    const barcode =
      typeof data === 'object' && data !== null && 'barcode' in data
        ? String((data as { barcode: unknown }).barcode)
        : undefined;
    const labelUrl = await this.getLabel(code);
    return {
      trackingCode: code,
      barcode: barcode && barcode !== code ? barcode : undefined,
      labelUrl: labelUrl ?? undefined,
    };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const token = await this.ensureToken();
    const path =
      typeof this.creds.trackShipmentPath === 'string' &&
      this.creds.trackShipmentPath.length > 0
        ? this.creds.trackShipmentPath
        : 'api/cargo/track';

    const { data, status } = await axios.get<unknown>(
      `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      {
        params: { barcode: trackingCode },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('MNG Kargo takip sorgusu başarısız');
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
        : 'api/cargo/cancel';

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
      throw new BadGatewayException('MNG Kargo iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<string | null> {
    const token = await this.ensureToken();
    const path =
      typeof this.creds.labelPath === 'string' && this.creds.labelPath.length > 0
        ? this.creds.labelPath
        : 'api/cargo/label';

    const { data, status } = await axios.get<unknown>(
      `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      {
        params: { barcode: trackingCode },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      return `https://www.mngkargo.com.tr/mngkargo/kargo-takip?barcode=${encodeURIComponent(trackingCode)}`;
    }
    const url = extractTrackingCodeFromPayload(data);
    return url ?? null;
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

function extractJwt(data: unknown): string | undefined {
  if (typeof data === 'string' && data.length > 20) {
    return data;
  }
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const r = data as Record<string, unknown>;
  const direct = [r.token, r.accessToken, r.jwt, r.Token];
  for (const d of direct) {
    if (typeof d === 'string' && d.length > 20) {
      return d;
    }
  }
  if (typeof r.data === 'object' && r.data !== null) {
    return extractJwt(r.data);
  }
  return undefined;
}
