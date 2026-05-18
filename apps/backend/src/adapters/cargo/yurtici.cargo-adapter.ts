import { BadGatewayException, Logger } from '@nestjs/common';
import axios from 'axios';

import type {
  CreateShipmentParams,
  ICargoAdapter,
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
  singleEventFromText,
  soap11Envelope,
} from './cargo-adapter.helpers';

const DEFAULT_KOPS_URL =
  'https://ws.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices';
const DEFAULT_TRACKING_URL =
  'https://webservices.yurticikargo.com.tr/KargoTakipService/KargoTakipServisi.svc';

export class YurticiCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(YurticiCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const endpoint =
      typeof this.creds.shippingWsUrl === 'string' && this.creds.shippingWsUrl.length > 0
        ? this.creds.shippingWsUrl
        : DEFAULT_KOPS_URL;

    const inner = `
<SaveCustomerShippingOrder xmlns="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
  <userName>${escapeXml(username)}</userName>
  <password>${escapeXml(password)}</password>
  <ShippingOrderVO>
    <cargoKey>${escapeXml(params.orderId)}</cargoKey>
    <receiverCustName>${escapeXml(params.receiverName)}</receiverCustName>
    <receiverAddress>${escapeXml(params.receiverAddress)}</receiverAddress>
    <cityName>${escapeXml(params.receiverCity)}</cityName>
    <townName>${escapeXml(params.receiverDistrict)}</townName>
    <receiverPhone1>${escapeXml(params.receiverPhone)}</receiverPhone1>
    <desi>${String(params.desi ?? Math.max(1, params.weight))}</desi>
    <kg>${String(params.weight)}</kg>
    ${params.notes ? `<description>${escapeXml(params.notes)}</description>` : ''}
  </ShippingOrderVO>
</SaveCustomerShippingOrder>`;

    try {
      const { data, status } = await axios.post<string>(
        endpoint,
        soap11Envelope(inner),
        {
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            SOAPAction:
              '"http://yurticikargo.com.tr/ShippingOrderDispatcherServices/SaveCustomerShippingOrder"',
          },
          timeout: 45_000,
          responseType: 'text',
          validateStatus: () => true,
        },
      );
      if (status < 200 || status >= 300) {
        throw new Error(`HTTP ${String(status)}`);
      }
      const parsed = parseXml(data) as unknown;
      const code =
        extractTrackingCodeFromPayload(parsed) ??
        extractWaybillFromSoapFault(data) ??
        extractBetweenTags(data, 'docNumber', 'cargoKey');
      if (!code) {
        this.logger.warn('Yurtiçi gönderi yanıtı ayrıştırılamadı');
        throw new BadGatewayException('Yurtiçi Kargo yanıtı işlenemedi');
      }
      const labelUrl = await this.getLabel(code);
      return { trackingCode: code, labelUrl: labelUrl ?? undefined };
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
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const endpoint =
      typeof this.creds.trackingWsUrl === 'string' && this.creds.trackingWsUrl.length > 0
        ? this.creds.trackingWsUrl
        : DEFAULT_TRACKING_URL;

    const inner = `
<ListInvDocumentInterfaceByTrackingNumber xmlns="http://yurticikargo.com.tr/TrackingWS">
  <userName>${escapeXml(username)}</userName>
  <password>${escapeXml(password)}</password>
  <language>TR</language>
  <documentNumber>${escapeXml(trackingCode)}</documentNumber>
</ListInvDocumentInterfaceByTrackingNumber>`;

    try {
      const { data, status } = await axios.post<string>(
        endpoint,
        soap11Envelope(inner),
        {
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            SOAPAction:
              '"http://yurticikargo.com.tr/TrackingWS/ListInvDocumentInterfaceByTrackingNumber"',
          },
          timeout: 45_000,
          responseType: 'text',
          validateStatus: () => true,
        },
      );
      if (status < 200 || status >= 300) {
        throw new Error(`HTTP ${String(status)}`);
      }
      const text = stripHtml(getDeepString(parseXml(data) as unknown, ['status']) ?? data);
      const statusNorm = normalizeTrackingStatus(text || trackingCode);
      return {
        trackingCode,
        status: statusNorm,
        lastUpdate: new Date(),
        events: singleEventFromText(trackingCode, text || 'Takip yanıtı alındı'),
      };
    } catch (error) {
      this.logger.warn('Yurtiçi trackShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      throw new BadGatewayException('Yurtiçi Kargo takip sorgusu başarısız');
    }
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const endpoint =
      typeof this.creds.shippingWsUrl === 'string' && this.creds.shippingWsUrl.length > 0
        ? this.creds.shippingWsUrl
        : DEFAULT_KOPS_URL;

    const inner = `
<CancelShipment xmlns="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
  <userName>${escapeXml(username)}</userName>
  <password>${escapeXml(password)}</password>
  <cargoKey>${escapeXml(trackingCode)}</cargoKey>
</CancelShipment>`;

    const { status, data } = await axios.post<string>(
      endpoint,
      soap11Envelope(inner),
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction:
            '"http://yurticikargo.com.tr/ShippingOrderDispatcherServices/CancelShipment"',
        },
        timeout: 45_000,
        responseType: 'text',
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('Yurtiçi Kargo iptal isteği reddedildi');
    }
    if (String(data).toLowerCase().includes('fault')) {
      throw new BadGatewayException('Yurtiçi Kargo iptal işlemi tamamlanamadı');
    }
  }

  async getLabel(trackingCode: string): Promise<string | null> {
    const base =
      typeof this.creds.labelBaseUrl === 'string' && this.creds.labelBaseUrl.length > 0
        ? this.creds.labelBaseUrl.replace(/\/$/, '')
        : 'https://ws.yurticikargo.com/KOPSWebServices/LabelPrintService';
    return `${base}?documentId=${encodeURIComponent(trackingCode)}`;
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

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractBetweenTags(xml: string, ...tags: string[]): string | undefined {
  for (const tag of tags) {
    const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
    const m = re.exec(xml);
    if (m?.[1] && m[1].trim().length > 0) {
      return m[1].trim();
    }
  }
  return undefined;
}

function extractWaybillFromSoapFault(xml: string): string | undefined {
  const m = /waybill[^>]*>([^<]+)</i.exec(xml);
  return m?.[1]?.trim();
}
