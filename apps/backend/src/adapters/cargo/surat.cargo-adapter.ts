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
  normalizeTrackingStatus,
  parseXml,
  requireStringField,
  singleEventFromText,
  soap11Envelope,
} from './cargo-adapter.helpers';

const DEFAULT_SVC =
  'https://svc.suratcargo.com/ServiceManager/SuratCargoService.svc';

export class SuratCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(SuratCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const endpoint =
      typeof this.creds.serviceUrl === 'string' && this.creds.serviceUrl.length > 0
        ? this.creds.serviceUrl
        : DEFAULT_SVC;

    const inner = `
<GonderiyiMusteriHavuzunaEk xmlns="http://tempuri.org/">
  <kullaniciAdi>${escapeXml(username)}</kullaniciAdi>
  <sifre>${escapeXml(password)}</sifre>
  <musteriReferansNo>${escapeXml(params.orderId)}</musteriReferansNo>
  <aliciAdi>${escapeXml(params.receiverName)}</aliciAdi>
  <aliciAdres>${escapeXml(params.receiverAddress)}</aliciAdres>
  <aliciIl>${escapeXml(params.receiverCity)}</aliciIl>
  <aliciIlce>${escapeXml(params.receiverDistrict)}</aliciIlce>
  <aliciTel>${escapeXml(params.receiverPhone)}</aliciTel>
  <agirlik>${String(params.weight)}</agirlik>
  <desi>${String(params.desi ?? Math.max(1, params.weight))}</desi>
</GonderiyiMusteriHavuzunaEk>`;

    try {
      const { data, status } = await axios.post<string>(
        endpoint,
        soap11Envelope(inner),
        {
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            SOAPAction: '"http://tempuri.org/ISuratCargoService/GonderiyiMusteriHavuzunaEk"',
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
        extractTrackingCodeFromPayload(parsed) ?? extractBarcodeFromXml(data);
      if (!code) {
        this.logger.warn('Sürat gönderi yanıtı ayrıştırılamadı');
        throw new BadGatewayException('Sürat Kargo yanıtı işlenemedi');
      }
      return { trackingCode: code };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException('Sürat Kargo gönderi oluşturma başarısız');
    }
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const endpoint =
      typeof this.creds.serviceUrl === 'string' && this.creds.serviceUrl.length > 0
        ? this.creds.serviceUrl
        : DEFAULT_SVC;

    const inner = `
<GonderiHareketleriniGetir xmlns="http://tempuri.org/">
  <kullaniciAdi>${escapeXml(username)}</kullaniciAdi>
  <sifre>${escapeXml(password)}</sifre>
  <barkod>${escapeXml(trackingCode)}</barkod>
</GonderiHareketleriniGetir>`;

    const { data, status } = await axios.post<string>(
      endpoint,
      soap11Envelope(inner),
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '"http://tempuri.org/ISuratCargoService/GonderiHareketleriniGetir"',
        },
        timeout: 45_000,
        responseType: 'text',
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('Sürat Kargo takip sorgusu başarısız');
    }
    const text = data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      trackingCode,
      status: normalizeTrackingStatus(text),
      lastUpdate: new Date(),
      events: singleEventFromText(trackingCode, text || 'Takip yanıtı alındı'),
    };
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');
    const endpoint =
      typeof this.creds.serviceUrl === 'string' && this.creds.serviceUrl.length > 0
        ? this.creds.serviceUrl
        : DEFAULT_SVC;

    const inner = `
<GonderiyiIptalEt xmlns="http://tempuri.org/">
  <kullaniciAdi>${escapeXml(username)}</kullaniciAdi>
  <sifre>${escapeXml(password)}</sifre>
  <barkod>${escapeXml(trackingCode)}</barkod>
</GonderiyiIptalEt>`;

    const { status, data } = await axios.post<string>(
      endpoint,
      soap11Envelope(inner),
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '"http://tempuri.org/ISuratCargoService/GonderiyiIptalEt"',
        },
        timeout: 45_000,
        responseType: 'text',
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300 || data.toLowerCase().includes('fault')) {
      throw new BadGatewayException('Sürat Kargo iptal işlemi tamamlanamadı');
    }
  }

  async getLabel(trackingCode: string): Promise<string | null> {
    void trackingCode;
    return null;
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

function extractBarcodeFromXml(xml: string): string | undefined {
  const m = /<barkod[^>]*>([^<]+)</i.exec(xml);
  return m?.[1]?.trim();
}
