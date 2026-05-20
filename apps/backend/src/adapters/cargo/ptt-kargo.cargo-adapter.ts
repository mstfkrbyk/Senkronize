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
  getDeepString,
  normalizeTrackingStatus,
  requireStringField,
  singleEventFromText,
} from './cargo-adapter.helpers';

const DEFAULT_BASE = 'https://apizone.ptt.gov.tr';

export class PttKargoCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(PttKargoCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_BASE;
  }

  private headers(): Record<string, string> {
    const apiKey = requireStringField(this.creds, 'apiKey');
    return {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    };
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const body = {
      aliciAdi: params.receiverName,
      aliciTelefon: params.receiverPhone,
      aliciAdres: params.receiverAddress,
      aliciIl: params.receiverCity,
      aliciIlce: params.receiverDistrict,
      agirlik: params.weight,
      desi: params.desi ?? params.weight,
      referansNo: params.orderId,
      aciklama: params.notes ?? '',
    };

    const { data, status } = await axios.post<unknown>(
      `${this.baseUrl()}/kargo/v1/gonderiler`,
      body,
      {
        headers: this.headers(),
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('PTT Kargo create HTTP hata', { status });
      throw new BadGatewayException('PTT Kargo gönderi oluşturma başarısız');
    }
    const code =
      getDeepString(data, ['barkodNo', 'BarkodNo']) ??
      extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException('PTT Kargo yanıtında takip numarası bulunamadı');
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const { data, status } = await axios.get<unknown>(
      `${this.baseUrl()}/kargo/v1/gonderiler/${encodeURIComponent(trackingCode)}/takip`,
      {
        headers: this.headers(),
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
    void trackingCode;
    throw new BadGatewayException('PTT Kargo iptali bu adaptörde desteklenmiyor');
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    try {
      const { data, status, headers } = await axios.get<ArrayBuffer>(
        `${this.baseUrl()}/kargo/v1/gonderiler/${encodeURIComponent(trackingCode)}/etiket`,
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
      await axios.get(`${this.baseUrl()}/kargo/v1/health`, {
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
