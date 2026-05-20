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

const DEFAULT_BASE =
  'https://customerservice.araskargo.com.tr/ArasCargoCustomerIntegrationService/ArasCargoIntegrationService.asmx';
const ARAS_NS = 'http://tempuri.org/';

export class ArasCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(ArasCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_BASE;
  }

  private customerCode(): string {
    return (
      optionalStringField(this.creds, 'customerCode') ??
      optionalStringField(this.creds, 'customerNumber') ??
      requireStringField(this.creds, 'username')
    );
  }

  private userName(): string {
    return (
      optionalStringField(this.creds, 'userName') ??
      optionalStringField(this.creds, 'username') ??
      this.customerCode()
    );
  }

  private password(): string {
    return requireStringField(this.creds, 'password');
  }

  private senderName(): string {
    return optionalStringField(this.creds, 'senderName') ?? 'Senkronize';
  }

  private async soapCall(action: string, innerBody: string): Promise<unknown> {
    const { data, status } = await axios.post<string>(
      this.baseUrl(),
      soap11Envelope(innerBody),
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${ARAS_NS}${action}"`,
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

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const shipmentKey = params.orderId;
    const desi = params.desi ?? Math.max(1, params.weight);

    const inner = `
<SetShipment xmlns="${ARAS_NS}">
  <CustomerCode>${escapeXml(this.customerCode())}</CustomerCode>
  <UserName>${escapeXml(this.userName())}</UserName>
  <Password>${escapeXml(this.password())}</Password>
  <ShipmentInfo>
    <Shipment>
      <SenderName>${escapeXml(this.senderName())}</SenderName>
      <ReceiverName>${escapeXml(params.receiverName)}</ReceiverName>
      <ReceiverAddress>${escapeXml(params.receiverAddress)}</ReceiverAddress>
      <ReceiverCity>${escapeXml(params.receiverCity)}</ReceiverCity>
      <ReceiverTown>${escapeXml(params.receiverDistrict)}</ReceiverTown>
      <ReceiverPhone>${escapeXml(params.receiverPhone)}</ReceiverPhone>
      <Weight>${String(params.weight)}</Weight>
      <Desi>${String(desi)}</Desi>
      <PieceCount>1</PieceCount>
      <ShipmentKey>${escapeXml(shipmentKey)}</ShipmentKey>
      <Description>${escapeXml(params.notes ?? '')}</Description>
    </Shipment>
  </ShipmentInfo>
</SetShipment>`;

    try {
      const parsed = await this.soapCall('SetShipment', inner);
      const code =
        extractTrackingCodeFromPayload(parsed) ??
        getDeepString(parsed, ['ShipmentKey', 'Barcode', 'barcode']) ??
        shipmentKey;
      return { trackingCode: code };
    } catch (error) {
      this.logger.warn('Aras createShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException('Aras Kargo gönderi oluşturma başarısız');
    }
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const inner = `
<GetShipmentInfo xmlns="${ARAS_NS}">
  <UserName>${escapeXml(this.userName())}</UserName>
  <Password>${escapeXml(this.password())}</Password>
  <ShipmentKey>${escapeXml(trackingCode)}</ShipmentKey>
</GetShipmentInfo>`;

    try {
      const parsed = await this.soapCall('GetShipmentInfo', inner);
      const statusRaw =
        getDeepString(parsed, ['Status', 'status', 'Durum', 'durum']) ?? '';
      return {
        trackingCode,
        status: normalizeTrackingStatus(statusRaw),
        lastUpdate: new Date(),
        events: singleEventFromText(trackingCode, statusRaw || 'Takip yanıtı alındı'),
      };
    } catch (error) {
      this.logger.warn('Aras trackShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      throw new BadGatewayException('Aras Kargo takip sorgusu başarısız');
    }
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    const inner = `
<CancelShipment xmlns="${ARAS_NS}">
  <CustomerCode>${escapeXml(this.customerCode())}</CustomerCode>
  <UserName>${escapeXml(this.userName())}</UserName>
  <Password>${escapeXml(this.password())}</Password>
  <ShipmentKey>${escapeXml(trackingCode)}</ShipmentKey>
</CancelShipment>`;

    try {
      await this.soapCall('CancelShipment', inner);
    } catch {
      throw new BadGatewayException('Aras Kargo iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    const inner = `
<GetShipmentLabel xmlns="${ARAS_NS}">
  <UserName>${escapeXml(this.userName())}</UserName>
  <Password>${escapeXml(this.password())}</Password>
  <ShipmentKey>${escapeXml(trackingCode)}</ShipmentKey>
</GetShipmentLabel>`;

    try {
      const parsed = await this.soapCall('GetShipmentLabel', inner);
      return extractBase64PdfFromPayload(parsed);
    } catch (error) {
      this.logger.warn('Aras etiket alınamadı', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  async getRates(params: RateParams): Promise<CargoRate[]> {
    const estimate = estimateDomesticCargoPrice(params.weightKg, params.desi, 26, 2.6);
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
