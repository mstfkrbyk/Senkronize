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

  private accountNumber(): string {
    if (typeof this.creds.accountNumber === 'string' && this.creds.accountNumber.length > 0) {
      return this.creds.accountNumber;
    }
    return requireStringField(this.creds, 'apiKey');
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const body = {
      plannedShippingDateAndTime: new Date().toISOString(),
      pickup: { isRequested: false },
      productCode: 'N',
      accounts: [{ typeCode: 'shipper', number: this.accountNumber() }],
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
    const { data, status } = await axios.get<unknown>(
      `${BASE}/shipments/${encodeURIComponent(trackingCode)}/tracking`,
      {
        headers: { Authorization: this.authHeader() },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
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

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    void trackingCode;
    return null;
  }

  async getRates(params: RateParams): Promise<CargoRate[]> {
    const planned = new Date();
    planned.setDate(planned.getDate() + 1);
    const qs = new URLSearchParams({
      accountNumber: this.accountNumber(),
      originCountryCode: params.fromCountryCode,
      destinationCountryCode: params.toCountryCode,
      weight: String(Math.max(0.5, params.weightKg)),
      length: '20',
      width: '15',
      height: '10',
      plannedShippingDate: planned.toISOString(),
      isCustomsDeclarable: 'false',
      unitOfMeasurement: 'metric',
    });
    if (params.fromPostalCode.trim()) {
      qs.set('originPostalCode', params.fromPostalCode.trim());
    }
    if (params.toPostalCode.trim()) {
      qs.set('destinationPostalCode', params.toPostalCode.trim());
    }
    if (params.fromCity.trim()) {
      qs.set('originCityName', params.fromCity.trim());
    }
    if (params.toCity.trim()) {
      qs.set('destinationCityName', params.toCity.trim());
    }

    const { data, status } = await axios.get<unknown>(`${BASE}/rates?${qs.toString()}`, {
      headers: { Authorization: this.authHeader() },
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      return [];
    }
    return parseDhlRates(data);
  }

  async testConnection(): Promise<boolean> {
    try {
      await axios.get(`${BASE}/shipments/0000000000/tracking`, {
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

function parseDhlRates(data: unknown): CargoRate[] {
  if (typeof data !== 'object' || data === null) {
    return [];
  }
  const products = (data as { products?: unknown }).products;
  if (!Array.isArray(products)) {
    return [];
  }
  const out: CargoRate[] = [];
  for (const p of products) {
    if (typeof p !== 'object' || p === null) {
      continue;
    }
    const r = p as Record<string, unknown>;
    const name = typeof r.productName === 'string' ? r.productName : 'DHL Express';
    const code = typeof r.productCode === 'string' ? r.productCode : undefined;
    const priceObj = r.totalPrice as Record<string, unknown> | undefined;
    const raw = priceObj?.price ?? r.price;
    const price = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(price)) {
      continue;
    }
    const currency =
      typeof priceObj?.currencyType === 'string' ? priceObj.currencyType : 'EUR';
    out.push({ serviceCode: code, serviceName: name, price, currency });
  }
  return out;
}
