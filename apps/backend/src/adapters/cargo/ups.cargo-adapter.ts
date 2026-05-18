import { BadGatewayException, Logger } from '@nestjs/common';
import axios from 'axios';

import type {
  CreateShipmentParams,
  ICargoAdapter,
  ShipmentResult,
  TrackingResult,
} from '../cargo-adapter.interface';
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  extractTrackingCodeFromPayload,
  normalizeTrackingStatus,
  requireStringField,
  singleEventFromText,
} from './cargo-adapter.helpers';

export class UpsCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(UpsCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private getBase(): string {
    if (this.creds.sandbox === true) {
      return 'https://wwwcie.ups.com/api';
    }
    return 'https://onlinetools.ups.com/api';
  }

  private async getAccessToken(): Promise<string> {
    const clientId = requireStringField(this.creds, 'clientId');
    const clientSecret = requireStringField(this.creds, 'clientSecret');
    const base = this.getBase().replace(/\/api$/, '');
    return await fetchClientCredentialsToken(
      `${base}/security/v1/oauth/token`,
      clientId,
      clientSecret,
    );
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const token = await this.getAccessToken();
    const shipperNumber = requireStringField(this.creds, 'shipperNumber');
    const base = this.getBase();

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
            Phone: { Number: params.receiverPhone.replace(/\D/g, '').slice(0, 15) || '0000000000' },
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
      `${base}/shipments/v2403/ship`,
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
      extractTrackingCodeFromPayload(data) ??
      extractUpsTrackingFromShipmentResponse(data);
    if (!code) {
      throw new BadGatewayException('UPS yanıtında takip numarası bulunamadı');
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const token = await this.getAccessToken();
    const base = this.getBase();
    const { data, status } = await axios.get<unknown>(
      `${base}/track/v1/details/${encodeURIComponent(trackingCode)}`,
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

  async getLabel(trackingCode: string): Promise<string | null> {
    void trackingCode;
    return null;
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
