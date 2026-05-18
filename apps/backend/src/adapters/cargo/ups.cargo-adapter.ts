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
  extractTrackingCodeFromPayload,
  normalizeTrackingStatus,
  requireStringField,
  singleEventFromText,
} from './cargo-adapter.helpers';

export class UpsCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(UpsCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private getApiRoot(): string {
    if (this.creds.sandbox === true) {
      return 'https://wwwcie.ups.com/api';
    }
    return 'https://onlinetools.ups.com/api';
  }

  private getTokenUrl(): string {
    if (this.creds.sandbox === true) {
      return 'https://wwwcie.ups.com/security/v1/oauth/token';
    }
    return 'https://onlinetools.ups.com/security/v1/oauth/token';
  }

  private async getAccessToken(): Promise<string> {
    const clientId = requireStringField(this.creds, 'clientId');
    const clientSecret = requireStringField(this.creds, 'clientSecret');
    const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
    const { data, status } = await axios.post<Record<string, unknown>>(
      this.getTokenUrl(),
      new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
          'X-Merchant-Id': clientId,
        },
        timeout: 20_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('UPS OAuth HTTP hata', { status });
      throw new BadGatewayException('UPS kimlik doğrulama başarısız');
    }
    const token = typeof data.access_token === 'string' ? data.access_token : '';
    if (!token) {
      throw new BadGatewayException('UPS erişim anahtarı alınamadı');
    }
    return token;
  }

  private shipPath(): string {
    if (typeof this.creds.shipPath === 'string' && this.creds.shipPath.length > 0) {
      return this.creds.shipPath.startsWith('/') ? this.creds.shipPath : `/${this.creds.shipPath}`;
    }
    return '/shipments/v1/ship';
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const token = await this.getAccessToken();
    const shipperNumber = requireStringField(this.creds, 'shipperNumber');
    const apiRoot = this.getApiRoot();

    const shipment = {
      ShipmentRequest: {
        Request: { RequestOption: 'nonvalidate', SubVersion: '2403' },
        Shipment: {
          Description: params.notes ?? 'Senkronize',
          Shipper: {
            ShipperNumber: shipperNumber,
            Name: 'Shipper',
            AttentionName: 'Shipper',
            Phone: { Number: '0000000000' },
            Address: {
              AddressLine: ['Merkez'],
              City: 'Istanbul',
              StateProvinceCode: '',
              PostalCode: '34000',
              CountryCode: 'TR',
            },
          },
          ShipTo: {
            Name: params.receiverName,
            AttentionName: params.receiverName,
            Phone: {
              Number: params.receiverPhone.replace(/\D/g, '').slice(0, 15) || '0000000000',
            },
            Address: {
              AddressLine: [params.receiverAddress.slice(0, 105)],
              City: params.receiverCity,
              StateProvinceCode: '',
              PostalCode: '34000',
              CountryCode: 'TR',
            },
          },
          ShipFrom: {
            Name: 'Shipper',
            AttentionName: 'Shipper',
            Phone: { Number: '0000000000' },
            Address: {
              AddressLine: ['Merkez'],
              City: 'Istanbul',
              StateProvinceCode: '',
              PostalCode: '34000',
              CountryCode: 'TR',
            },
          },
          PaymentInformation: {
            ShipmentCharge: {
              Type: '01',
              BillShipper: { AccountNumber: shipperNumber },
            },
          },
          Service: { Code: '65', Description: 'UPS Saver' },
          Package: {
            Description: 'Package',
            Packaging: { Code: '02', Description: 'Customer Supplied Package' },
            PackageWeight: {
              UnitOfMeasurement: { Code: 'KGS' },
              Weight: String(Math.max(0.1, params.weight)),
            },
          },
        },
      },
    };

    const { data, status } = await axios.post<unknown>(
      `${apiRoot}${this.shipPath()}`,
      shipment,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          transId: params.orderId,
          transactionSrc: 'senkronize',
        },
        timeout: 60_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('UPS ship HTTP hata', { status });
      throw new BadGatewayException('UPS gönderi oluşturma başarısız');
    }
    const code =
      extractTrackingCodeFromPayload(data) ?? extractUpsTrackingFromShipmentResponse(data);
    if (!code) {
      throw new BadGatewayException('UPS yanıtında takip numarası bulunamadı');
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const token = await this.getAccessToken();
    const apiRoot = this.getApiRoot();
    const { data, status } = await axios.get<unknown>(
      `${apiRoot}/track/v1/details/${encodeURIComponent(trackingCode)}`,
      {
        params: { locale: 'tr_TR', returnMilestones: 'true' },
        headers: {
          Authorization: `Bearer ${token}`,
          transId: trackingCode,
          transactionSrc: 'senkronize',
        },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('UPS takip sorgusu başarısız');
    }
    const raw = JSON.stringify(data);
    return {
      trackingCode,
      status: normalizeTrackingStatus(raw),
      lastUpdate: new Date(),
      events: singleEventFromText(trackingCode, raw),
    };
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    void trackingCode;
    throw new BadGatewayException('UPS gönderi iptali bu entegrasyon üzerinden desteklenmiyor');
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    try {
      const token = await this.getAccessToken();
      const shipperNumber = requireStringField(this.creds, 'shipperNumber');
      const apiRoot = this.getApiRoot();
      const body = {
        LabelRecoveryRequest: {
          LabelDelivery: { LabelLinkIndicator: '' },
          LabelSpecification: {
            LabelImageFormat: { Code: 'PDF' },
            HTTPUserAgent: 'Mozilla/4.5',
          },
          Request: { SubVersion: '1903' },
          TrackingNumber: trackingCode,
          ShipperNumber: shipperNumber,
        },
      };
      const { data, status } = await axios.post<unknown>(
        `${apiRoot}/labels/v1/recover`,
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            transId: trackingCode,
            transactionSrc: 'senkronize',
          },
          responseType: 'json',
          timeout: 45_000,
          validateStatus: () => true,
        },
      );
      if (status < 200 || status >= 300) {
        return null;
      }
      const b64 = extractLabelBase64(data);
      if (b64) {
        return Buffer.from(b64, 'base64');
      }
    } catch (error) {
      this.logger.warn('UPS etiket alınamadı', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
    return null;
  }

  async getRates(params: RateParams): Promise<CargoRate[]> {
    const token = await this.getAccessToken();
    const shipperNumber = requireStringField(this.creds, 'shipperNumber');
    const apiRoot = this.getApiRoot();
    const payload = {
      RateRequest: {
        Request: { SubVersion: '1703' },
        Shipment: {
          Shipper: {
            Name: 'Shipper',
            ShipperNumber: shipperNumber,
            Address: {
              AddressLine: ['Merkez'],
              City: params.fromCity,
              StateProvinceCode: '',
              PostalCode: params.fromPostalCode || '34000',
              CountryCode: params.fromCountryCode,
            },
          },
          ShipTo: {
            Name: 'Receiver',
            Address: {
              AddressLine: ['Teslimat'],
              City: params.toCity,
              StateProvinceCode: '',
              PostalCode: params.toPostalCode || '34000',
              CountryCode: params.toCountryCode,
            },
          },
          ShipFrom: {
            Name: 'Shipper',
            ShipperNumber: shipperNumber,
            Address: {
              AddressLine: ['Merkez'],
              City: params.fromCity,
              StateProvinceCode: '',
              PostalCode: params.fromPostalCode || '34000',
              CountryCode: params.fromCountryCode,
            },
          },
          Service: { Code: '65' },
          ShipmentRatingOptions: { NegotiatedRatesIndicator: '' },
          Package: {
            PackagingType: { Code: '02', Description: 'Package' },
            PackageWeight: {
              UnitOfMeasurement: { Code: 'KGS' },
              Weight: String(Math.max(0.1, params.weightKg)),
            },
          },
        },
      },
    };
    const { data, status } = await axios.post<unknown>(
      `${apiRoot}/rating/v1/rates`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          transId: `rate-${String(Date.now())}`,
          transactionSrc: 'senkronize',
        },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      return [];
    }
    return parseUpsRatedShipments(data);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }
}

function extractUpsTrackingFromShipmentResponse(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const root = data as Record<string, unknown>;
  const shipmentResponse = root.ShipmentResponse as Record<string, unknown> | undefined;
  const results = shipmentResponse?.ShipmentResults as Record<string, unknown> | undefined;
  const pkg = results?.PackageResults as Record<string, unknown> | undefined;
  const num = pkg?.TrackingNumber;
  return typeof num === 'string' ? num : undefined;
}

function extractLabelBase64(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const r = data as Record<string, unknown>;
  const lr = r.LabelRecoveryResponse as Record<string, unknown> | undefined;
  const ar = lr?.LabelResults as Record<string, unknown> | undefined;
  const b64 = ar?.LabelImage;
  if (typeof b64 === 'string' && b64.length > 20) {
    return b64;
  }
  const flat = r.GraphicImage ?? r.labelImage;
  return typeof flat === 'string' ? flat : undefined;
}

function parseUpsRatedShipments(data: unknown): CargoRate[] {
  if (typeof data !== 'object' || data === null) {
    return [];
  }
  const root = data as Record<string, unknown>;
  const rr = root.RateResponse as Record<string, unknown> | undefined;
  const rated = rr?.RatedShipment as unknown;
  const list: unknown[] = Array.isArray(rated) ? rated : rated ? [rated] : [];
  const out: CargoRate[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const rs = item as Record<string, unknown>;
    const service = rs.Service as Record<string, unknown> | undefined;
    const name =
      typeof service?.Description === 'string'
        ? service.Description
        : typeof service?.Code === 'string'
          ? `UPS ${service.Code}`
          : 'UPS';
    const totalCharges = rs.TotalCharges as Record<string, unknown> | undefined;
    const monetary = totalCharges?.MonetaryValue;
    const price = typeof monetary === 'string' ? Number(monetary) : Number(monetary);
    if (!Number.isFinite(price)) {
      continue;
    }
    const currency =
      typeof totalCharges?.CurrencyCode === 'string' ? totalCharges.CurrencyCode : 'TRY';
    out.push({
      serviceCode: typeof service?.Code === 'string' ? service.Code : undefined,
      serviceName: name,
      price,
      currency,
    });
  }
  return out;
}
