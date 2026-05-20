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
  escapeXml,
  extractTrackingCodeFromPayload,
  getDeepString,
  normalizeTrackingStatus,
  parseXml,
  requireStringField,
  soap11Envelope,
  singleEventFromText,
} from './cargo-adapter.helpers';

const DEFAULT_BASE = 'https://api.dpd.de/v1';

export class DpdCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(DpdCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_BASE;
  }

  private wsdlUrl(): string {
    if (typeof this.creds.wsdlUrl === 'string' && this.creds.wsdlUrl.length > 0) {
      return this.creds.wsdlUrl;
    }
    return `${this.baseUrl()}/soap?wsdl`;
  }

  private soapEndpoint(): string {
    if (typeof this.creds.soapEndpoint === 'string' && this.creds.soapEndpoint.length > 0) {
      return this.creds.soapEndpoint;
    }
    return `${this.baseUrl()}/soap`;
  }

  private authXml(): string {
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const depot =
      typeof this.creds.depotNumber === 'string' && this.creds.depotNumber.length > 0
        ? `<depotNumber>${escapeXml(this.creds.depotNumber)}</depotNumber>`
        : '';
    return `<auth><username>${escapeXml(username)}</username><password>${escapeXml(password)}</password>${depot}</auth>`;
  }

  private async soapCall(action: string, innerBody: string): Promise<unknown> {
    const envelope = soap11Envelope(innerBody);
    const { data, status } = await axios.post<string>(this.soapEndpoint(), envelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: action,
      },
      timeout: 60_000,
      validateStatus: () => true,
      responseType: 'text',
    });
    if (status < 200 || status >= 300 || typeof data !== 'string') {
      this.logger.warn('DPD SOAP HTTP hata', { status, action });
      throw new BadGatewayException('DPD SOAP isteği başarısız');
    }
    return parseXml(data);
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    void this.wsdlUrl();
    const body = `<storeOrders>
${this.authXml()}
<order>
<reference>${escapeXml(params.orderId)}</reference>
<receiver>
<name>${escapeXml(params.receiverName)}</name>
<phone>${escapeXml(params.receiverPhone)}</phone>
<street>${escapeXml(params.receiverAddress)}</street>
<city>${escapeXml(params.receiverCity)}</city>
<district>${escapeXml(params.receiverDistrict)}</district>
</receiver>
<weight>${params.weight}</weight>
<note>${escapeXml(params.notes ?? '')}</note>
</order>
</storeOrders>`;

    const parsed = await this.soapCall('storeOrders', body);
    const code = extractTrackingCodeFromPayload(parsed);
    if (!code) {
      throw new BadGatewayException('DPD yanıtında takip numarası bulunamadı');
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    try {
      const { data, status } = await axios.get<unknown>(
        `${this.baseUrl()}/tracking/${encodeURIComponent(trackingCode)}`,
        {
          headers: { Accept: 'application/json' },
          auth: {
            username: requireStringField(this.creds, 'username'),
            password: requireStringField(this.creds, 'password'),
          },
          timeout: 45_000,
          validateStatus: () => true,
        },
      );
      if (status >= 200 && status < 300) {
        const raw = JSON.stringify(data);
        return {
          trackingCode,
          status: normalizeTrackingStatus(raw),
          lastUpdate: new Date(),
          events: singleEventFromText(trackingCode, raw),
        };
      }
    } catch {
      // REST başarısız — SOAP fallback
    }

    const body = `<getTrackingData>
${this.authXml()}
<parcelNumber>${escapeXml(trackingCode)}</parcelNumber>
</getTrackingData>`;
    const parsed = await this.soapCall('getTrackingData', body);
    const raw = JSON.stringify(parsed);
    const location = getDeepString(parsed, ['location', 'city', 'depot']);
    return {
      trackingCode,
      status: normalizeTrackingStatus(raw),
      lastUpdate: new Date(),
      location,
      events: singleEventFromText(trackingCode, raw),
    };
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    const body = `<cancelShipment>
${this.authXml()}
<parcelNumber>${escapeXml(trackingCode)}</parcelNumber>
</cancelShipment>`;
    await this.soapCall('cancelShipment', body);
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    const body = `<getLabel>
${this.authXml()}
<parcelNumber>${escapeXml(trackingCode)}</parcelNumber>
</getLabel>`;
    const parsed = await this.soapCall('getLabel', body);
    const b64 = getDeepString(parsed, ['label', 'labelData', 'pdf', 'content']);
    if (!b64) {
      return null;
    }
    try {
      return Buffer.from(b64, 'base64');
    } catch {
      return null;
    }
  }

  async getRates(_params: RateParams): Promise<CargoRate[]> {
    void _params;
    return [];
  }

  async testConnection(): Promise<boolean> {
    try {
      await axios.get(this.wsdlUrl(), {
        auth: {
          username: requireStringField(this.creds, 'username'),
          password: requireStringField(this.creds, 'password'),
        },
        timeout: 15_000,
        validateStatus: () => true,
      });
      return true;
    } catch {
      return false;
    }
  }
}
