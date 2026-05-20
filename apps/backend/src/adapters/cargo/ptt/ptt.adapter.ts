import { BadGatewayException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

import type {
  CargoRate,
  CreateShipmentParams,
  RateParams,
  ShipmentResult,
  TrackingResult,
} from '../../cargo-adapter.interface';
import { CargoBaseAdapter } from '../cargo-base.adapter';
import {
  extractTrackingCodeFromPayload,
  getDeepString,
  normalizeTrackingStatus,
  optionalStringField,
  requireStringField,
  singleEventFromText,
} from '../cargo-adapter.helpers';

const DEFAULT_WSDL = 'https://ptteksipres.ptt.gov.tr/ws/PttEksipresWs';
const PTT_WEB_NS = 'http://web.ptt.gov.tr/';

export class PttKargoCargoAdapter extends CargoBaseAdapter {
  private readonly logger = new Logger(PttKargoCargoAdapter.name);

  constructor(creds: Record<string, unknown>) {
    super(creds);
  }

  private endpoint(): string {
    const raw =
      optionalStringField(this.creds, 'serviceUrl') ??
      optionalStringField(this.creds, 'baseUrl') ??
      DEFAULT_WSDL;
    return raw.replace(/\?wsdl$/i, '').replace(/\/$/, '');
  }

  private customerNo(): string {
    const fromAlias =
      optionalStringField(this.creds, 'customerNo') ??
      optionalStringField(this.creds, 'customerCode') ??
      optionalStringField(this.creds, 'musteriNo') ??
      optionalStringField(this.creds, 'musteri_no');
    if (fromAlias) {
      return fromAlias;
    }
    return requireStringField(this.creds, 'customerNo');
  }

  private password(): string {
    const fromAlias =
      optionalStringField(this.creds, 'password') ??
      optionalStringField(this.creds, 'sifre');
    if (fromAlias) {
      return fromAlias;
    }
    return requireStringField(this.creds, 'password');
  }

  private buildKargoBody(params: CreateShipmentParams, barcode: string): string {
    const postalCode =
      optionalStringField(this.creds, 'defaultPostalCode') ?? '00000';

    return this.soapEnvelopeWithNs('web', PTT_WEB_NS, 'kargo', {
      musteri_no: this.customerNo(),
      sifre: this.password(),
      barkod: barcode,
      alici_ad: params.receiverName,
      alici_tel: params.receiverPhone,
      alici_adres: params.receiverAddress,
      alici_ilce: params.receiverDistrict,
      alici_il: params.receiverCity,
      alici_posta_kodu: postalCode,
      desi: String(params.desi ?? Math.max(1, params.weight)),
    });
  }

  private buildTakipBody(barcode: string): string {
    return this.soapEnvelopeWithNs('web', PTT_WEB_NS, 'takip', {
      musteri_no: this.customerNo(),
      sifre: this.password(),
      barkod: barcode,
    });
  }

  private uniqueBarcode(orderId: string): string {
    const suffix = randomBytes(4).toString('hex');
    const base = orderId.replace(/\W/g, '').slice(0, 16) || 'SNK';
    return `${base}${suffix}`.slice(0, 24);
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const barcode = this.uniqueBarcode(params.orderId);
    try {
      const parsed = await this.postSoap(
        this.endpoint(),
        '""',
        this.buildKargoBody(params, barcode),
      );
      const code =
        getDeepString(parsed, ['barkod', 'Barkod', 'barkodNo', 'gonderiNo']) ??
        extractTrackingCodeFromPayload(parsed) ??
        barcode;
      return { trackingCode: code, barcode: code };
    } catch (error) {
      this.logger.warn('PTT Kargo createShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException('PTT Kargo gönderi oluşturma başarısız');
    }
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    try {
      const parsed = await this.postSoap(
        this.endpoint(),
        '""',
        this.buildTakipBody(trackingCode),
      );
      const statusText =
        getDeepString(parsed, ['durum', 'Durum', 'aciklama', 'Aciklama']) ??
        JSON.stringify(parsed);
      return {
        trackingCode,
        status: normalizeTrackingStatus(statusText),
        lastUpdate: new Date(),
        events: singleEventFromText(trackingCode, statusText),
      };
    } catch (error) {
      this.logger.warn('PTT Kargo trackShipment başarısız', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      throw new BadGatewayException('PTT Kargo takip sorgusu başarısız');
    }
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    void trackingCode;
    throw new BadGatewayException('PTT Kargo iptali bu adaptörde desteklenmiyor');
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
      await this.postSoap(this.endpoint(), '""', this.buildTakipBody('0000000000'));
      return true;
    } catch {
      return false;
    }
  }
}
