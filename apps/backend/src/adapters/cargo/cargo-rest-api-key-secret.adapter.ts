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
import type { RestCargoAdapterConfig } from './cargo-rest-api-key.adapter';

export class RestApiKeySecretCargoAdapter implements ICargoAdapter {
  private readonly logger: Logger;

  constructor(
    private readonly creds: Record<string, unknown>,
    private readonly config: RestCargoAdapterConfig,
  ) {
    this.logger = new Logger(config.loggerName);
  }

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return this.config.defaultBase.replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    const apiKey = requireStringField(this.creds, 'apiKey');
    const apiSecret = requireStringField(this.creds, 'apiSecret');
    const token = Buffer.from(`${apiKey}:${apiSecret}`, 'utf8').toString('base64');
    return {
      'Content-Type': 'application/json',
      Authorization: `Basic ${token}`,
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
      { headers: this.headers(), timeout: 45_000, validateStatus: () => true },
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
        : (this.config.trackPath ?? 'shipments/track/{trackingNo}').replace(/^\//, '');
    const path = pathTpl.replace('{trackingNo}', encodeURIComponent(trackingCode));

    const { data, status } = await axios.get<unknown>(`${this.baseUrl()}/${path}`, {
      headers: this.headers(),
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
      { trackingNumber: trackingCode, parcelNumber: trackingCode },
      { headers: this.headers(), timeout: 45_000, validateStatus: () => true },
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
          : (this.config.labelPath ?? 'shipments/label/{trackingNo}').replace(/^\//, '');
      const path = pathTpl.replace('{trackingNo}', encodeURIComponent(trackingCode));
      const { data, status, headers } = await axios.get<ArrayBuffer>(
        `${this.baseUrl()}/${path}`,
        {
          headers: this.headers(),
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
      await axios.get(`${this.baseUrl()}/health`, {
        headers: this.headers(),
        timeout: 10_000,
        validateStatus: () => true,
      });
      return true;
    } catch {
      return false;
    }
  }
}
