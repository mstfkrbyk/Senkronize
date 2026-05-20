import { BadGatewayException, Logger } from '@nestjs/common';
import axios from 'axios';

import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
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
import type { RestCargoAdapterConfig } from './cargo-rest-api-key.adapter';

export interface RestOAuthCargoAdapterConfig extends RestCargoAdapterConfig {
  tokenPath?: string;
}

export class RestOAuthCargoAdapter implements ICargoAdapter {
  private readonly logger: Logger;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly creds: Record<string, unknown>,
    private readonly config: RestOAuthCargoAdapterConfig,
  ) {
    this.logger = new Logger(config.loggerName);
  }

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return this.config.defaultBase.replace(/\/$/, '');
  }

  private tokenUrl(): string {
    if (typeof this.creds.tokenUrl === 'string' && this.creds.tokenUrl.length > 0) {
      return this.creds.tokenUrl;
    }
    const path = (this.config.tokenPath ?? 'oauth/token').replace(/^\//, '');
    return `${this.baseUrl()}/${path}`;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now) {
      return this.tokenCache.token;
    }
    const clientId = requireStringField(this.creds, 'clientId');
    const clientSecret = requireStringField(this.creds, 'clientSecret');
    const token = await fetchClientCredentialsToken(
      this.tokenUrl(),
      clientId,
      clientSecret,
    );
    this.tokenCache = { token, expiresAt: now + 3_300_000 };
    return token;
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  private defaultCreateBody(params: CreateShipmentParams): Record<string, unknown> {
    return {
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
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const path =
      typeof this.creds.createPath === 'string' && this.creds.createPath.length > 0
        ? this.creds.createPath.replace(/^\//, '')
        : (this.config.createPath ?? 'shipments').replace(/^\//, '');

    const body = this.config.createBodyBuilder
      ? this.config.createBodyBuilder(params)
      : this.defaultCreateBody(params);

    const { data, status } = await axios.post<unknown>(
      `${this.baseUrl()}/${path}`,
      body,
      { headers: await this.headers(), timeout: 45_000, validateStatus: () => true },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('createShipment HTTP hata', { status });
      throw new BadGatewayException(`${this.config.loggerName} gönderi oluşturma başarısız`);
    }
    const code = extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException(
        `${this.config.loggerName} yanıtında takip numarası bulunamadı`,
      );
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const pathTpl =
      typeof this.creds.trackPath === 'string' && this.creds.trackPath.length > 0
        ? this.creds.trackPath.replace(/^\//, '')
        : (this.config.trackPath ?? 'shipments/{trackingNo}/track').replace(/^\//, '');
    const path = pathTpl.replace('{trackingNo}', encodeURIComponent(trackingCode));

    const { data, status } = await axios.get<unknown>(`${this.baseUrl()}/${path}`, {
      headers: await this.headers(),
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new BadGatewayException(`${this.config.loggerName} takip sorgusu başarısız`);
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
    const path =
      typeof this.creds.cancelPath === 'string' && this.creds.cancelPath.length > 0
        ? this.creds.cancelPath.replace(/^\//, '')
        : (this.config.cancelPath ?? 'shipments/cancel').replace(/^\//, '');

    const { status } = await axios.post(
      `${this.baseUrl()}/${path}`,
      { trackingNumber: trackingCode },
      { headers: await this.headers(), timeout: 45_000, validateStatus: () => true },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException(`${this.config.loggerName} iptal isteği başarısız`);
    }
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    try {
      const pathTpl =
        typeof this.creds.labelPath === 'string' && this.creds.labelPath.length > 0
          ? this.creds.labelPath.replace(/^\//, '')
          : (this.config.labelPath ?? 'shipments/{trackingNo}/label').replace(/^\//, '');
      const path = pathTpl.replace('{trackingNo}', encodeURIComponent(trackingCode));
      const { data, status, headers } = await axios.get<ArrayBuffer>(
        `${this.baseUrl()}/${path}`,
        {
          headers: await this.headers(),
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
      this.logger.warn('Etiket alınamadı', {
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
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }
}
