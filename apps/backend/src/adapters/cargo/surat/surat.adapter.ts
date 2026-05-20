import { BadGatewayException, Logger } from '@nestjs/common';

import type {
  CargoRate,
  CreateShipmentParams,
  RateParams,
  ShipmentResult,
  TrackingResult,
} from '../../cargo-adapter.interface';
import { CargoBaseAdapter } from '../cargo-base.adapter';
import {
  escapeXml,
  extractTrackingCodeFromPayload,
  getDeepString,
  normalizeTrackingStatus,
  optionalStringField,
  requireStringField,
  singleEventFromText,
} from '../cargo-adapter.helpers';

const DEFAULT_SVC = 'https://ws.suratkargo.com.tr/KargoServisleri.svc';
const SURAT_KAR_NS = 'http://tempuri.org/';

export class SuratCargoAdapter extends CargoBaseAdapter {
  private readonly logger = new Logger(SuratCargoAdapter.name);

  constructor(creds: Record<string, unknown>) {
    super(creds);
  }

  private endpoint(): string {
    const raw =
      optionalStringField(this.creds, 'serviceUrl') ??
      optionalStringField(this.creds, 'baseUrl') ??
      DEFAULT_SVC;
    return raw.replace(/\?wsdl$/i, '').replace(/\/$/, '');
  }

  private dealerCode(): string {
    return (
      optionalStringField(this.creds, 'dealerCode') ??
      optionalStringField(this.creds, 'bayiKodu') ??
      requireStringField(this.creds, 'dealer_code')
    );
  }

  private username(): string {
    return requireStringField(this.creds, 'username');
  }

  private password(): string {
    return requireStringField(this.creds, 'password');
  }

  private senderName(): string {
    return optionalStringField(this.creds, 'senderName') ?? 'Gönderici';
  }

  private buildCreateShipmentRequest(params: CreateShipmentParams): string {
    const cityCode = this.getCityCode(params.receiverCity);
    const desi = String(params.desi ?? Math.max(1, params.weight));
    const shipmentCount =
      optionalStringField(this.creds, 'shipmentCount') ?? '1';

    return `
<kar:CreateShipment xmlns:kar="${SURAT_KAR_NS}">
  <kar:request>
    <kar:DealerCode>${escapeXml(this.dealerCode())}</kar:DealerCode>
    <kar:UserName>${escapeXml(this.username())}</kar:UserName>
    <kar:Password>${escapeXml(this.password())}</kar:Password>
    <kar:SenderName>${escapeXml(this.senderName())}</kar:SenderName>
    <kar:ReceiverName>${escapeXml(params.receiverName)}</kar:ReceiverName>
    <kar:ReceiverCityCode>${escapeXml(cityCode || params.receiverCity)}</kar:ReceiverCityCode>
    <kar:ReceiverPhone>${escapeXml(params.receiverPhone)}</kar:ReceiverPhone>
    <kar:ReceiverAddress>${escapeXml(params.receiverAddress)}</kar:ReceiverAddress>
    <kar:Desi>${escapeXml(desi)}</kar:Desi>
    <kar:ShipmentCount>${escapeXml(shipmentCount)}</kar:ShipmentCount>
  </kar:request>
</kar:CreateShipment>`;
  }

  private buildTrackingRequest(trackingCode: string): string {
    return `
<kar:GetShipmentTracking xmlns:kar="${SURAT_KAR_NS}">
  <kar:request>
    <kar:DealerCode>${escapeXml(this.dealerCode())}</kar:DealerCode>
    <kar:UserName>${escapeXml(this.username())}</kar:UserName>
    <kar:Password>${escapeXml(this.password())}</kar:Password>
    <kar:Barcode>${escapeXml(trackingCode)}</kar:Barcode>
  </kar:request>
</kar:GetShipmentTracking>`;
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    try {
      const parsed = await this.postSoap(
        this.endpoint(),
        `"${SURAT_KAR_NS}IKargoServisleri/CreateShipment"`,
        this.buildCreateShipmentRequest(params),
      );
      const code =
        getDeepString(parsed, ['Barcode', 'barcode', 'barkod', 'TrackingNumber']) ??
        extractTrackingCodeFromPayload(parsed);
      if (!code) {
        this.logger.warn('Sürat gönderi yanıtı ayrıştırılamadı');
        throw new BadGatewayException('Sürat Kargo yanıtı işlenemedi');
      }
      return { trackingCode: code };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      this.logger.warn('Sürat createShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      throw new BadGatewayException('Sürat Kargo gönderi oluşturma başarısız');
    }
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    try {
      const parsed = await this.postSoap(
        this.endpoint(),
        `"${SURAT_KAR_NS}IKargoServisleri/GetShipmentTracking"`,
        this.buildTrackingRequest(trackingCode),
      );
      const statusText =
        getDeepString(parsed, ['Status', 'status', 'Durum', 'durum', 'Aciklama']) ??
        JSON.stringify(parsed);
      return {
        trackingCode,
        status: normalizeTrackingStatus(statusText),
        lastUpdate: new Date(),
        events: singleEventFromText(trackingCode, statusText),
      };
    } catch (error) {
      this.logger.warn('Sürat trackShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      throw new BadGatewayException('Sürat Kargo takip sorgusu başarısız');
    }
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    void trackingCode;
    throw new BadGatewayException('Sürat Kargo iptal işlemi bu SOAP sürümünde desteklenmiyor');
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
      await this.postSoap(
        this.endpoint(),
        `"${SURAT_KAR_NS}IKargoServisleri/GetShipmentTracking"`,
        this.buildTrackingRequest('0000000000000'),
      );
      return true;
    } catch {
      return false;
    }
  }
}
