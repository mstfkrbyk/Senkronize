import { BadGatewayException, Logger } from '@nestjs/common';
import axios from 'axios';

import type {
  CreateShipmentParams,
  ICargoAdapter,
  ShipmentResult,
  TrackingResult,
} from '../cargo-adapter.interface';
import {
  extractTrackingCodeFromPayload,
  normalizeTrackingStatus,
  requireStringField,
  singleEventFromText,
} from './cargo-adapter.helpers';

const BASE = 'https://express.api.dhl.com/mydhlapi';

export class DhlCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(DhlCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private authHeader(): string {
    const key = requireStringField(this.creds, 'apiKey');
    const secret = requireStringField(this.creds, 'apiSecret');
    const token = Buffer.from(`${key}:${secret}`, 'utf8').toString('base64');
    return `Basic ${token}`;
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const account =
      typeof this.creds.accountNumber === 'string' && this.creds.accountNumber.length > 0
        ? this.creds.accountNumber
        : requireStringField(this.creds, 'apiKey');

    const body = {
      plannedShippingDateAndTime: new Date().toISOString(),
      pickup: { isRequested: false },
      productCode: 'N',
      accounts: [{ typeCode: 'shipper', number: account }],
      customerDetails: {
        shipperDetails: {
          postalAddress: {
            postalCode: '34000',
            cityName: 'Istanbul',
            countryCode: 'TR',
            addressLine1: 'Warehouse',
          },
          contactInformation: {
            phone: '+900000000000',
            companyName: 'Shipper',
            fullName: 'Shipper',
          },
        },
        receiverDetails: {
          postalAddress: {
            postalCode: '34000',
            cityName: params.receiverCity,
            countryCode: 'TR',
            addressLine1: params.receiverAddress.slice(0, 45),
          },
          contactInformation: {
            phone: `+${params.receiverPhone.replace(/\D/g, '').slice(0, 14) || '900000000000'}`,
            companyName: params.receiverName,
            fullName: params.receiverName,
          },
        },
      },
      content: {
        packages: [
          {
            weight: Math.max(0.5, params.weight),
            dimensions: { length: 10, width: 10, height: 10 },
          },
        ],
        isCustomsDeclarable: false,
        description: params.notes ?? 'Goods',
        unitOfMeasurement: 'metric',
      },
    };

    const { data, status } = await axios.post<unknown>(`${BASE}/shipments`, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader(),
      },
      timeout: 60_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      this.logger.warn('DHL ship HTTP hata', { status });
      throw new BadGatewayException('DHL gönderi oluşturma başarısız');
    }
    const code = extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException('DHL yanıtında takip numarası bulunamadı');
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const { data, status } = await axios.get<unknown>(`${BASE}/tracking`, {
      params: { shipmentTrackingNumber: trackingCode },
      headers: { Authorization: this.authHeader() },
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('DHL takip sorgusu başarısız');
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
    const { status } = await axios.delete(`${BASE}/shipments/${encodeURIComponent(trackingCode)}`, {
      headers: { Authorization: this.authHeader() },
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('DHL iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<string | null> {
    void trackingCode;
    return null;
  }

  async getRates(
    fromCountry: string,
    toCountry: string,
    weightKg: number,
  ): Promise<unknown> {
    const body = {
      customerDetails: {
        shipperDetails: { postalCode: '34000', cityName: 'Istanbul', countryCode: fromCountry },
        receiverDetails: { postalCode: '34000', cityName: 'Istanbul', countryCode: toCountry },
      },
      accounts: [{ typeCode: 'shipper', number: requireStringField(this.creds, 'apiKey') }],
      productAndServices: [{ productCode: 'N' }],
      packages: [{ weight: Math.max(0.5, weightKg) }],
      plannedShippingDateAndTime: new Date().toISOString(),
      unitOfMeasurement: 'metric',
    };
    const { data, status } = await axios.post<unknown>(`${BASE}/rates`, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader(),
      },
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('DHL fiyat sorgusu başarısız');
    }
    return data;
  }

  async testConnection(): Promise<boolean> {
    try {
      await axios.get(`${BASE}/tracking`, {
        params: { shipmentTrackingNumber: '0000000000' },
        headers: { Authorization: this.authHeader() },
        timeout: 15_000,
        validateStatus: () => true,
      });
      return true;
    } catch {
      return false;
    }
  }
}
