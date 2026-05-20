import { BadGatewayException, Logger } from '@nestjs/common';
import axios from 'axios';

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
  normalizeTrackingStatus,
  optionalStringField,
  requireStringField,
  singleEventFromText,
} from '../cargo-adapter.helpers';

const MOCK_BASE = 'https://api-mock.dhl.com/mydhlapi';
const PROD_BASE = 'https://api.dhl.com/mydhlapi';

export class DhlCargoAdapter extends CargoBaseAdapter {
  private readonly logger = new Logger(DhlCargoAdapter.name);

  constructor(creds: Record<string, unknown>) {
    super(creds);
  }

  private getBaseUrl(): string {
    if (this.creds.sandbox === false) {
      return PROD_BASE;
    }
    return optionalStringField(this.creds, 'baseUrl') ?? MOCK_BASE;
  }

  private authHeader(): string {
    const apiKey = requireStringField(this.creds, 'apiKey');
    const token = Buffer.from(`${apiKey}:`, 'utf8').toString('base64');
    return `Basic ${token}`;
  }

  private accountNumber(): string {
    return (
      optionalStringField(this.creds, 'accountNumber') ??
      requireStringField(this.creds, 'apiKey')
    );
  }

  private productCode(): string {
    return optionalStringField(this.creds, 'productCode') ?? 'P';
  }

  private plannedShippingDateTime(): string {
    const now = new Date();
    const offset = '+03:00';
    const pad = (n: number): string => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return `${date}T${time} GMT${offset}`;
  }

  private packageDimensions(weightKg: number): Record<string, unknown> {
    const desi = Math.max(1, Math.ceil(weightKg));
    return {
      length: desi,
      width: Math.max(10, Math.round(desi * 0.6)),
      height: Math.max(5, Math.round(desi * 0.4)),
    };
  }

  private buildCustomerDetails(params: CreateShipmentParams | RateParams): Record<string, unknown> {
    const isShipment = 'receiverName' in params;
    const receiverCity = isShipment ? params.receiverCity : params.toCity;
    const receiverAddress = isShipment
      ? params.receiverAddress.slice(0, 45)
      : 'Teslimat Adresi';
    const receiverName = isShipment ? params.receiverName : 'Receiver';
    const receiverPhone = isShipment
      ? `+${params.receiverPhone.replace(/\D/g, '').slice(0, 14) || '900000000000'}`
      : '+900000000000';

    return {
      shipperDetails: {
        postalAddress: {
          postalCode: optionalStringField(this.creds, 'shipperPostalCode') ?? '34000',
          cityName: optionalStringField(this.creds, 'shipperCity') ?? 'Istanbul',
          countryCode: optionalStringField(this.creds, 'shipperCountry') ?? 'TR',
          addressLine1: optionalStringField(this.creds, 'shipperAddress') ?? 'Warehouse',
        },
        contactInformation: {
          phone: optionalStringField(this.creds, 'shipperPhone') ?? '+900000000000',
          companyName: optionalStringField(this.creds, 'shipperName') ?? 'Shipper',
          fullName: optionalStringField(this.creds, 'shipperName') ?? 'Shipper',
        },
      },
      receiverDetails: {
        postalAddress: {
          postalCode: optionalStringField(this.creds, 'receiverPostalCode') ?? '34000',
          cityName: receiverCity,
          countryCode: 'TR',
          addressLine1: receiverAddress,
        },
        contactInformation: {
          phone: receiverPhone,
          companyName: receiverName,
          fullName: receiverName,
        },
      },
    };
  }

  private buildPackages(weightKg: number): Record<string, unknown>[] {
    const weight = Math.max(0.5, weightKg);
    return [
      {
        weight: { netValue: weight, unitOfMeasurement: 'kg' },
        dimensions: this.packageDimensions(weight),
      },
    ];
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const body = {
      plannedShippingDateAndTime: this.plannedShippingDateTime(),
      pickup: { isRequested: false },
      productCode: this.productCode(),
      accounts: [{ typeCode: 'shipper', number: this.accountNumber() }],
      customerDetails: this.buildCustomerDetails(params),
      packages: this.buildPackages(params.weight),
    };

    const { data, status } = await axios.post<unknown>(
      `${this.getBaseUrl()}/shipments`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader(),
        },
        timeout: 60_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('DHL ship HTTP hata', { status });
      throw new BadGatewayException('DHL gönderi oluşturma başarısız');
    }
    const code = extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException('DHL yanıtında takip numarası bulunamadı');
    }
    const labelUrl = extractDhlLabelUrl(data);
    return { trackingCode: code, labelUrl };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const { data, status } = await axios.get<unknown>(
      `${this.getBaseUrl()}/shipments/${encodeURIComponent(trackingCode)}/tracking`,
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
    const { status } = await axios.delete(
      `${this.getBaseUrl()}/shipments/${encodeURIComponent(trackingCode)}`,
      {
        headers: { Authorization: this.authHeader() },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('DHL iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    try {
      const { data, status } = await axios.get<unknown>(
        `${this.getBaseUrl()}/shipments/${encodeURIComponent(trackingCode)}/documents`,
        {
          params: { typeCode: 'label', documentFormat: 'PDF' },
          headers: { Authorization: this.authHeader() },
          timeout: 45_000,
          validateStatus: () => true,
        },
      );
      if (status < 200 || status >= 300) {
        return null;
      }
      const b64 = extractDhlLabelBase64(data);
      if (b64) {
        return Buffer.from(b64, 'base64');
      }
    } catch (error) {
      this.logger.warn('DHL etiket alınamadı', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
    return null;
  }

  async getRates(params: RateParams): Promise<CargoRate[]> {
    const body = {
      customerDetails: this.buildCustomerDetails(params),
      packages: this.buildPackages(params.weightKg),
      productCode: this.productCode(),
      accounts: [{ typeCode: 'shipper', number: this.accountNumber() }],
      plannedShippingDateAndTime: this.plannedShippingDateTime(),
    };

    const { data, status } = await axios.post<unknown>(
      `${this.getBaseUrl()}/rates`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader(),
        },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      return [];
    }
    return parseDhlRates(data);
  }

  async testConnection(): Promise<boolean> {
    try {
      const { status } = await axios.get(
        `${this.getBaseUrl()}/shipments/0000000000/tracking`,
        {
          headers: { Authorization: this.authHeader() },
          timeout: 15_000,
          validateStatus: () => true,
        },
      );
      return status === 200 || status === 404;
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
    const delivery = r.deliveryCapabilities as Record<string, unknown> | undefined;
    const transitDays =
      typeof delivery?.totalTransitDays === 'number'
        ? delivery.totalTransitDays
        : undefined;
    out.push({
      serviceCode: code,
      serviceName: name,
      price,
      currency,
      transitDaysMin: transitDays,
      transitDaysMax: transitDays,
    });
  }
  return out;
}

function extractDhlLabelUrl(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const docs = (data as { documents?: unknown }).documents;
  if (!Array.isArray(docs)) {
    return undefined;
  }
  for (const doc of docs) {
    if (typeof doc !== 'object' || doc === null) {
      continue;
    }
    const url = (doc as Record<string, unknown>).url;
    if (typeof url === 'string' && url.length > 0) {
      return url;
    }
  }
  return undefined;
}

function extractDhlLabelBase64(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const docs = (data as { documents?: unknown }).documents;
  if (!Array.isArray(docs)) {
    const flat = (data as Record<string, unknown>).content;
    return typeof flat === 'string' && flat.length > 20 ? flat : undefined;
  }
  for (const doc of docs) {
    if (typeof doc !== 'object' || doc === null) {
      continue;
    }
    const r = doc as Record<string, unknown>;
    const content = r.content ?? r.documentContent;
    if (typeof content === 'string' && content.length > 20) {
      return content;
    }
  }
  return undefined;
}
