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
  escapeXml,
  extractTrackingCodeFromPayload,
  getDeepString,
  normalizeTrackingStatus,
  optionalStringField,
  parseXml,
  requireStringField,
  singleEventFromText,
  soap11Envelope,
} from './cargo-adapter.helpers';

const DEFAULT_BASE =
  'https://customerapi.yurticikargo.com:8443/KurumosalMusteriEntegrasyonu';

export class YurticiCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(YurticiCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_BASE;
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const apiKey = optionalStringField(this.creds, 'apiKey');
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    return headers;
  }

  private async soapRequest(action: string, innerBody: string): Promise<unknown> {
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const apiKey = optionalStringField(this.creds, 'apiKey');

    const authBlock = `
  <userName>${escapeXml(username)}</userName>
  <password>${escapeXml(password)}</password>
  ${apiKey ? `<apiKey>${escapeXml(apiKey)}</apiKey>` : ''}`;

    const inner = innerBody.includes('<userName>')
      ? innerBody
      : innerBody.replace(/^(\s*<[^>]+>)/, `$1${authBlock}`);

    const { data, status } = await axios.post<string>(
      this.baseUrl(),
      soap11Envelope(inner),
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${action}"`,
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        timeout: 45_000,
        responseType: 'text',
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${String(status)}`);
    }
    if (String(data).toLowerCase().includes('fault')) {
      throw new Error('SOAP fault');
    }
    return parseXml(data) as unknown;
  }

  private async request<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const apiKey = optionalStringField(this.creds, 'apiKey');
    const url = `${this.baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

    const { data, status } = await axios.request<T>({
      url,
      method,
      data: body,
      headers: {
        ...this.authHeaders(),
        ...(apiKey ? {} : {}),
        Authorization: `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`,
      },
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${String(status)}`);
    }
    return data;
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const inner = `
<SendShipment xmlns="http://yurticikargo.com.tr/KurumsalMusteriEntegrasyonu">
  <userName>${escapeXml(requireStringField(this.creds, 'username'))}</userName>
  <password>${escapeXml(requireStringField(this.creds, 'password'))}</password>
  <ShipmentAddRequest>
    <ShipmentRequest>
      <payer>1</payer>
      <serviceType>1</serviceType>
      <shipmentCount>1</shipmentCount>
      <receiverName>${escapeXml(params.receiverName)}</receiverName>
      <receiverPhone1>${escapeXml(params.receiverPhone)}</receiverPhone1>
      <receiverCityName>${escapeXml(params.receiverCity)}</receiverCityName>
      <receiverTownName>${escapeXml(params.receiverDistrict)}</receiverTownName>
      <receiverAddress>${escapeXml(params.receiverAddress)}</receiverAddress>
      <waybillNo></waybillNo>
      <cargoKey>${escapeXml(params.orderId)}</cargoKey>
      <kg>${String(params.weight)}</kg>
      <desi>${String(params.desi ?? Math.max(1, params.weight))}</desi>
    </ShipmentRequest>
  </ShipmentAddRequest>
</SendShipment>`;

    try {
      const parsed = await this.soapRequest(
        'http://yurticikargo.com.tr/KurumsalMusteriEntegrasyonu/SendShipment',
        inner,
      );
      const code =
        getDeepString(parsed, ['waybillNo', 'waybillNumber', 'cargoKey']) ??
        extractTrackingCodeFromPayload(parsed);
      if (!code) {
        this.logger.warn('Yurtiçi gönderi yanıtı ayrıştırılamadı');
        throw new BadGatewayException('Yurtiçi Kargo yanıtı işlenemedi');
      }
      return { trackingCode: code, labelUrl: this.buildLabelUrl(code) };
    } catch (error) {
      this.logger.warn('Yurtiçi createShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException('Yurtiçi Kargo gönderi oluşturma başarısız');
    }
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    try {
      const response = await this.request<unknown>(`/tracking/${encodeURIComponent(trackingCode)}`);
      const record = asRecord(response);
      const statusRaw =
        getDeepString(response, ['Status', 'status', 'durum']) ??
        (record ? String(record.Status ?? record.status ?? '') : '');
      const events = parseYurticiTrackingEvents(response, trackingCode);
      return {
        trackingCode,
        status: this.mapStatus(statusRaw),
        lastUpdate: events[0]?.timestamp ?? new Date(),
        events: events.length > 0 ? events : singleEventFromText(trackingCode, statusRaw || 'Takip yanıtı alındı'),
      };
    } catch (error) {
      this.logger.warn('Yurtiçi trackShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      throw new BadGatewayException('Yurtiçi Kargo takip sorgusu başarısız');
    }
  }

  private mapStatus(raw: string): TrackingResult['status'] {
    return normalizeTrackingStatus(raw);
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    const inner = `
<CancelShipment xmlns="http://yurticikargo.com.tr/KurumsalMusteriEntegrasyonu">
  <userName>${escapeXml(requireStringField(this.creds, 'username'))}</userName>
  <password>${escapeXml(requireStringField(this.creds, 'password'))}</password>
  <cargoKey>${escapeXml(trackingCode)}</cargoKey>
</CancelShipment>`;

    try {
      await this.soapRequest(
        'http://yurticikargo.com.tr/KurumsalMusteriEntegrasyonu/CancelShipment',
        inner,
      );
    } catch {
      throw new BadGatewayException('Yurtiçi Kargo iptal işlemi tamamlanamadı');
    }
  }

  private buildLabelUrl(trackingCode: string): string {
    const base =
      typeof this.creds.labelBaseUrl === 'string' && this.creds.labelBaseUrl.length > 0
        ? this.creds.labelBaseUrl.replace(/\/$/, '')
        : `${this.baseUrl()}/label`;
    return `${base}?documentId=${encodeURIComponent(trackingCode)}`;
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    try {
      const url = this.buildLabelUrl(trackingCode);
      const { data, status, headers } = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 30_000,
        validateStatus: () => true,
        headers: this.authHeaders(),
      });
      if (status >= 200 && status < 300 && data) {
        const ct = String(headers['content-type'] ?? '');
        if (ct.includes('pdf') || ct.includes('octet-stream')) {
          return Buffer.from(new Uint8Array(data));
        }
      }
    } catch (error) {
      this.logger.warn('Yurtiçi etiket indirilemedi', {
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
      await this.trackShipment('0000000000000');
      return true;
    } catch {
      return false;
    }
  }
}

function parseYurticiTrackingEvents(data: unknown, trackingCode: string): TrackingEvent[] {
  const record = asRecord(data);
  if (!record) {
    return [];
  }
  const list =
    record.trackingList ??
    record.TrackingList ??
    record.events ??
    record.Events;
  const items = asArray(list);
  const events: TrackingEvent[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) {
      continue;
    }
    const description =
      getDeepString(row, ['description', 'Description', 'aciklama', 'Aciklama']) ??
      getDeepString(row, ['status', 'Status']) ??
      '';
    const ts =
      getDeepString(row, ['date', 'Date', 'timestamp', 'Timestamp']) ??
      new Date().toISOString();
    const parsedDate = new Date(ts);
    events.push({
      timestamp: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      status: description.slice(0, 80),
      description: description || trackingCode,
      location: getDeepString(row, ['location', 'Location', 'sube', 'Sube']),
    });
  }
  return events;
}
