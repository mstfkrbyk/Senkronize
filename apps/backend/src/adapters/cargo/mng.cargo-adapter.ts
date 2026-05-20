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
  optionalStringField,
  parseXml,
  requireStringField,
  singleEventFromText,
  soap11Envelope,
} from './cargo-adapter.helpers';

const DEFAULT_BASE = 'https://ws.mngkargo.com.tr/mngkargo.asmx';

export class MngCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(MngCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_BASE;
  }

  private customerNumber(): string {
    return (
      optionalStringField(this.creds, 'cusNo') ??
      optionalStringField(this.creds, 'customerNumber') ??
      optionalStringField(this.creds, 'customerCode') ??
      requireStringField(this.creds, 'username')
    );
  }

  private async soapRequest(action: string, innerBody: string): Promise<unknown> {
    const username = requireStringField(this.creds, 'username');
    const password = requireStringField(this.creds, 'password');

    const { data, status } = await axios.post<string>(
      this.baseUrl(),
      soap11Envelope(innerBody),
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"http://tempuri.org/${action}"`,
        },
        auth: { username, password },
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

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const cusNo = this.customerNumber();
    const recCityCode =
      optionalStringField(this.creds, 'recCityCode') ??
      params.receiverCity.slice(0, 3).toUpperCase();
    const recTownCode =
      optionalStringField(this.creds, 'recTownCode') ??
      params.receiverDistrict.slice(0, 3).toUpperCase();

    const inner = `
<CreateCargo xmlns="http://tempuri.org/">
  <pChIrsaliyeNo>${escapeXml(params.orderId)}</pChIrsaliyeNo>
  <cargoKey>${escapeXml(params.orderId)}</cargoKey>
  <cusNo>${escapeXml(cusNo)}</cusNo>
  <recName>${escapeXml(params.receiverName)}</recName>
  <recAddress>${escapeXml(params.receiverAddress)}</recAddress>
  <recCityCode>${escapeXml(recCityCode)}</recCityCode>
  <recTownCode>${escapeXml(recTownCode)}</recTownCode>
  <recTel>${escapeXml(params.receiverPhone)}</recTel>
  <weight>${String(params.weight)}</weight>
  <desi>${String(params.desi ?? params.weight)}</desi>
</CreateCargo>`;

    try {
      const parsed = await this.soapRequest('CreateCargo', inner);
      const code =
        extractTrackingCodeFromPayload(parsed) ??
        getDeepString(parsed, ['barcode', 'Barcode', 'cargoKey']);
      if (!code) {
        throw new BadGatewayException('MNG Kargo yanıtında takip numarası bulunamadı');
      }
      const labelUrl = `https://www.mngkargo.com.tr/mngkargo/kargo-takip?barcode=${encodeURIComponent(code)}`;
      return { trackingCode: code, labelUrl };
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
    const cusNo = this.customerNumber();
    const inner = `
<TrackCargo xmlns="http://tempuri.org/">
  <cargoKey>${escapeXml(trackingCode)}</cargoKey>
  <barcode>${escapeXml(trackingCode)}</barcode>
  <cusNo>${escapeXml(cusNo)}</cusNo>
</TrackCargo>`;

    try {
      const parsed = await this.soapRequest('TrackCargo', inner);
      const raw = JSON.stringify(parsed);
      const statusText = getDeepString(parsed, ['status', 'Status', 'durum']) ?? raw;
      return {
        trackingCode,
        status: normalizeTrackingStatus(statusText),
        lastUpdate: new Date(),
        events: singleEventFromText(trackingCode, statusText),
      };
    } catch (error) {
      this.logger.warn('MNG trackShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      throw new BadGatewayException('MNG Kargo takip sorgusu başarısız');
    }
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    void trackingCode;
    throw new BadGatewayException('MNG SOAP iptali bu sürümde desteklenmiyor');
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    void trackingCode;
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
