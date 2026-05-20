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
  estimateDomesticCargoPrice,
  extractBase64PdfFromPayload,
  extractTrackingCodeFromPayload,
  getDeepString,
  normalizeTrackingStatus,
  optionalStringField,
  parseXml,
  requireStringField,
  singleEventFromText,
  soap11Envelope,
} from './cargo-adapter.helpers';
import { resolveTurkishCityCode } from './turkish-city-codes';

const DEFAULT_SERVICE_URL =
  'https://services.yurticikargo.com:8085/KargoTakipService/KargoOperasyonlariService';
const CUS_NS = 'http://yurticikargo.com.tr/ws/cargooperations';

export class YurticiCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(YurticiCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private serviceUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\?wsdl$/i, '').replace(/\/$/, '');
    }
    return DEFAULT_SERVICE_URL;
  }

  private customerNumber(): string {
    return (
      optionalStringField(this.creds, 'customerNumber') ??
      optionalStringField(this.creds, 'customerNo') ??
      optionalStringField(this.creds, 'cusNo') ??
      requireStringField(this.creds, 'username')
    );
  }

  private password(): string {
    return requireStringField(this.creds, 'password');
  }

  private senderName(): string {
    return optionalStringField(this.creds, 'senderName') ?? 'Senkronize';
  }

  private async soapOperation(operation: string, innerXml: string): Promise<unknown> {
    const body = `
<cus:${operation} xmlns:cus="${CUS_NS}">
${innerXml}
</cus:${operation}>`;

    const { data, status } = await axios.post<string>(
      this.serviceUrl(),
      soap11Envelope(body),
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${CUS_NS}/${operation}"`,
        },
        timeout: 45_000,
        responseType: 'text',
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${String(status)}`);
    }
    const text = String(data);
    if (text.toLowerCase().includes('fault')) {
      throw new Error('SOAP fault');
    }
    return parseXml(text) as unknown;
  }

  private authBlock(): string {
    const customerNo = this.customerNumber();
    const password = this.password();
    return `
  <CUSTOMER_NUMBER>${escapeXml(customerNo)}</CUSTOMER_NUMBER>
  <PASSWORD>${escapeXml(password)}</PASSWORD>`;
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const cargoKey = params.orderId;
    const cityCode =
      optionalStringField(this.creds, 'receiverCityCode') ??
      resolveTurkishCityCode(params.receiverCity);
    const desi = params.desi ?? Math.max(1, params.weight);
    const piece = optionalStringField(this.creds, 'piece') ?? '1';

    const inner = `
  <request>${this.authBlock()}
    <CARGO_KEY>${escapeXml(cargoKey)}</CARGO_KEY>
    <SENDER_NAME>${escapeXml(this.senderName())}</SENDER_NAME>
    <RECEIVER_NAME>${escapeXml(params.receiverName)}</RECEIVER_NAME>
    <RECEIVER_ADDRESS>${escapeXml(params.receiverAddress)}</RECEIVER_ADDRESS>
    <RECEIVER_PHONE>${escapeXml(params.receiverPhone)}</RECEIVER_PHONE>
    <RECEIVER_CITY_CODE>${escapeXml(cityCode)}</RECEIVER_CITY_CODE>
    <DESI>${String(desi)}</DESI>
    <PIECE>${escapeXml(piece)}</PIECE>
  </request>`;

    try {
      const parsed = await this.soapOperation('addShipment', inner);
      const code =
        extractTrackingCodeFromPayload(parsed) ??
        getDeepString(parsed, ['CARGO_KEY', 'cargoKey', 'waybillNo']) ??
        cargoKey;
      return { trackingCode: code };
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
    const inner = `${this.authBlock()}
  <CARGO_KEY>${escapeXml(trackingCode)}</CARGO_KEY>`;

    try {
      const parsed = await this.soapOperation('queryShipment', inner);
      const statusRaw =
        getDeepString(parsed, ['status', 'Status', 'operationStatus', 'durum']) ?? '';
      const events = parseYurticiTrackingEvents(parsed, trackingCode);
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
      this.logger.warn('Yurtiçi trackShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      throw new BadGatewayException('Yurtiçi Kargo takip sorgusu başarısız');
    }
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    const inner = `${this.authBlock()}
  <CARGO_KEY>${escapeXml(trackingCode)}</CARGO_KEY>`;

    try {
      await this.soapOperation('cancelShipment', inner);
    } catch {
      throw new BadGatewayException('Yurtiçi Kargo iptal işlemi tamamlanamadı');
    }
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    const inner = `${this.authBlock()}
  <CARGO_KEY_LIST>${escapeXml(trackingCode)}</CARGO_KEY_LIST>`;

    try {
      const parsed = await this.soapOperation('getCargoLabel', inner);
      const pdf = extractBase64PdfFromPayload(parsed);
      if (pdf) {
        return pdf;
      }
    } catch (error) {
      this.logger.warn('Yurtiçi etiket alınamadı', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
    return null;
  }

  async getRates(params: RateParams): Promise<CargoRate[]> {
    const estimate = estimateDomesticCargoPrice(params.weightKg, params.desi, 28, 2.8);
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

function parseYurticiTrackingEvents(data: unknown, trackingCode: string): TrackingEvent[] {
  const record = asRecord(data);
  if (!record) {
    return [];
  }
  const list =
    record.trackingList ??
    record.TrackingList ??
    record.events ??
    record.Events ??
    record.movements ??
    record.Movements;
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
