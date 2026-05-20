import { BadGatewayException, Logger } from '@nestjs/common';
import axios from 'axios';

import type {
  CargoRate,
  CreateShipmentParams,
  ICargoAdapter,
  RateParams,
  ShipmentResult,
  TrackingEvent,
  TrackingResult,
} from '../cargo-adapter.interface';
import {
  asArray,
  asRecord,
  estimateDomesticCargoPrice,
  extractTrackingCodeFromPayload,
  getDeepString,
  normalizeTrackingStatus,
  optionalStringField,
  requireStringField,
  singleEventFromText,
} from './cargo-adapter.helpers';
import { resolveTurkishCityCode } from './turkish-city-codes';

const DEFAULT_REST_BASE = 'https://customerapi.mngkargo.com.tr/mngapi/api';

export class MngCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(MngCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_REST_BASE;
  }

  private companyId(): string {
    return (
      optionalStringField(this.creds, 'companyId') ??
      optionalStringField(this.creds, 'xCompanyId') ??
      optionalStringField(this.creds, 'customerNumber') ??
      optionalStringField(this.creds, 'cusNo') ??
      requireStringField(this.creds, 'username')
    );
  }

  private username(): string {
    return (
      optionalStringField(this.creds, 'apiUsername') ??
      optionalStringField(this.creds, 'userName') ??
      requireStringField(this.creds, 'username')
    );
  }

  private password(): string {
    return requireStringField(this.creds, 'password');
  }

  private restHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-company-id': this.companyId(),
      'x-username': this.username(),
      'x-password': this.password(),
    };
  }

  private async restRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
    const { data, status } = await axios.request<T>({
      url,
      method,
      data: body,
      headers: this.restHeaders(),
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${String(status)}`);
    }
    return data;
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const desi = params.desi ?? Math.max(1, params.weight);
    const cityCode =
      optionalStringField(this.creds, 'recCityCode') ??
      resolveTurkishCityCode(params.receiverCity);

    const body = {
      orderId: params.orderId,
      referenceId: params.orderId,
      cargoKey: params.orderId,
      recipient: {
        fullName: params.receiverName,
        address: params.receiverAddress,
        cityCode,
        district: params.receiverDistrict,
        phone: params.receiverPhone,
      },
      weight: params.weight,
      desi,
      pieceCount: 1,
      description: params.notes ?? '',
    };

    try {
      const data = await this.restRequest<unknown>('POST', '/shipments', body);
      const code =
        extractTrackingCodeFromPayload(data) ??
        getDeepString(data, ['barcode', 'Barcode', 'shipmentId', 'referenceId']) ??
        params.orderId;
      return { trackingCode: code };
    } catch (error) {
      this.logger.warn('MNG createShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException('MNG Kargo gönderi oluşturma başarısız');
    }
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    try {
      const data = await this.restRequest<unknown>(
        'GET',
        `/shipments/${encodeURIComponent(trackingCode)}/tracking`,
      );
      const statusRaw =
        getDeepString(data, ['status', 'Status', 'lastStatus', 'durum']) ?? '';
      const events = parseMngTrackingEvents(data, trackingCode);
      return {
        trackingCode,
        status: normalizeTrackingStatus(statusRaw),
        lastUpdate: events[0]?.timestamp ?? new Date(),
        events:
          events.length > 0
            ? events
            : singleEventFromText(trackingCode, statusRaw || 'Takip yanıtı alındı'),
      };
    } catch (error) {
      this.logger.warn('MNG trackShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      throw new BadGatewayException('MNG Kargo takip sorgusu başarısız');
    }
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    try {
      await this.restRequest<unknown>(
        'DELETE',
        `/shipments/${encodeURIComponent(trackingCode)}`,
      );
    } catch {
      throw new BadGatewayException('MNG Kargo iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    try {
      const data = await this.restRequest<unknown>(
        'GET',
        `/shipments/${encodeURIComponent(trackingCode)}/label`,
      );
      const record = asRecord(data);
      const url = getDeepString(data, ['labelUrl', 'LabelUrl', 'url']);
      if (url) {
        const { data: pdf, status } = await axios.get<ArrayBuffer>(url, {
          responseType: 'arraybuffer',
          timeout: 30_000,
          validateStatus: () => true,
        });
        if (status >= 200 && status < 300 && pdf) {
          return Buffer.from(new Uint8Array(pdf));
        }
      }
      const base64 = record
        ? getDeepString(record, ['labelBase64', 'pdfBase64', 'content'])
        : undefined;
      if (base64) {
        return Buffer.from(base64, 'base64');
      }
    } catch (error) {
      this.logger.warn('MNG etiket alınamadı', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
    return null;
  }

  async getRates(params: RateParams): Promise<CargoRate[]> {
    const estimate = estimateDomesticCargoPrice(params.weightKg, params.desi, 27, 2.7);
    return [estimate];
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

function parseMngTrackingEvents(data: unknown, trackingCode: string): TrackingEvent[] {
  const record = asRecord(data);
  if (!record) {
    return [];
  }
  const list = record.events ?? record.Events ?? record.trackingDetails ?? record.details;
  const items = asArray(list);
  const events: TrackingEvent[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) {
      continue;
    }
    const description =
      getDeepString(row, ['description', 'Description', 'statusDescription']) ??
      getDeepString(row, ['status', 'Status']) ??
      '';
    const ts =
      getDeepString(row, ['date', 'Date', 'eventDate', 'timestamp']) ??
      new Date().toISOString();
    const parsedDate = new Date(ts);
    events.push({
      timestamp: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      status: description.slice(0, 80),
      description: description || trackingCode,
      location: getDeepString(row, ['location', 'Location', 'branchName']),
    });
  }
  return events;
}
