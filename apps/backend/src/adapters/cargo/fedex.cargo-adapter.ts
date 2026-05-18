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
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  extractTrackingCodeFromPayload,
  normalizeTrackingStatus,
  requireStringField,
  singleEventFromText,
} from './cargo-adapter.helpers';

const FEDEX_BASE = 'https://apis.fedex.com';

export class FedexCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(FedexCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private async getAccessToken(): Promise<string> {
    const clientId = requireStringField(this.creds, 'clientId');
    const clientSecret = requireStringField(this.creds, 'clientSecret');
    return fetchClientCredentialsToken(
      `${FEDEX_BASE}/oauth/token`,
      clientId,
      clientSecret,
    );
  }

  private accountNumber(): string {
    if (typeof this.creds.accountNumber === 'string' && this.creds.accountNumber.length > 0) {
      return this.creds.accountNumber;
    }
    return requireStringField(this.creds, 'clientId');
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const token = await this.getAccessToken();
    const body = {
      labelResponseOptions: 'URL_ONLY',
      requestedShipment: {
        shipper: {
          contact: {
            personName: 'Shipper',
            phoneNumber: '0000000000',
          },
          address: {
            streetLines: ['Merkez'],
            city: 'Istanbul',
            postalCode: '34000',
            countryCode: 'TR',
          },
        },
        recipients: [
          {
            contact: {
              personName: params.receiverName,
              phoneNumber: params.receiverPhone.replace(/\D/g, '').slice(0, 15) || '0000000000',
            },
            address: {
              streetLines: [params.receiverAddress.slice(0, 70)],
              city: params.receiverCity,
              postalCode: '34000',
              countryCode: 'TR',
            },
          },
        ],
        shipDatestamp: new Date().toISOString().slice(0, 10),
        serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
        packagingType: 'YOUR_PACKAGING',
        pickupType: 'USE_SCHEDULED_PICKUP',
        blockInsightVisibility: false,
        shippingChargesPayment: {
          paymentType: 'SENDER',
          payor: {
            responsibleParty: {
              accountNumber: { value: this.accountNumber() },
            },
          },
        },
        labelSpecification: {
          imageType: 'PDF',
          labelStockType: 'PAPER_4X6',
        },
        requestedPackageLineItems: [
          {
            weight: { units: 'KG', value: Math.max(0.5, params.weight) },
          },
        ],
      },
      accountNumber: { value: this.accountNumber() },
    };

    const { data, status } = await axios.post<unknown>(
      `${FEDEX_BASE}/ship/v1/shipments`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-locale': 'tr_TR',
        },
        timeout: 60_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('FedEx ship HTTP hata', { status });
      throw new BadGatewayException('FedEx gönderi oluşturma başarısız');
    }
    const code =
      extractTrackingCodeFromPayload(data) ?? extractFedexTrackingNumber(data);
    if (!code) {
      throw new BadGatewayException('FedEx yanıtında takip numarası bulunamadı');
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const token = await this.getAccessToken();
    const body = {
      includeDetailedScans: true,
      trackingInfo: [{ trackingNumberInfo: { trackingNumber: trackingCode } }],
    };
    const { data, status } = await axios.post<unknown>(
      `${FEDEX_BASE}/track/v1/trackingnumbers`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-locale': 'tr_TR',
        },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('FedEx takip sorgusu başarısız');
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
    const token = await this.getAccessToken();
    const body = {
      accountNumber: { value: this.accountNumber() },
      trackingNumber: trackingCode,
    };
    const { status } = await axios.put(`${FEDEX_BASE}/ship/v1/shipments/cancel`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-locale': 'tr_TR',
      },
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('FedEx iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    void trackingCode;
    return null;
  }

  async getRates(params: RateParams): Promise<CargoRate[]> {
    const token = await this.getAccessToken();
    const body = {
      accountNumber: { value: this.accountNumber() },
      requestedShipment: {
        shipper: {
          address: {
            postalCode: params.fromPostalCode || '34000',
            countryCode: params.fromCountryCode,
            city: params.fromCity,
          },
        },
        recipient: {
          address: {
            postalCode: params.toPostalCode || '34000',
            countryCode: params.toCountryCode,
            city: params.toCity,
          },
        },
        pickupType: 'USE_SCHEDULED_PICKUP',
        rateRequestType: ['ACCOUNT', 'LIST'],
        requestedPackageLineItems: [
          {
            weight: { units: 'KG', value: Math.max(0.5, params.weightKg) },
          },
        ],
      },
    };
    const { data, status } = await axios.post<unknown>(
      `${FEDEX_BASE}/rate/v1/rates/quotes`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-locale': 'tr_TR',
        },
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      return [];
    }
    return parseFedexRates(data);
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

function extractFedexTrackingNumber(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const out = data as Record<string, unknown>;
  const oc = out.output as Record<string, unknown> | undefined;
  const transactions = oc?.transactionShipments;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return undefined;
  }
  const first = transactions[0] as Record<string, unknown>;
  const pieces = first.pieceResponses;
  if (!Array.isArray(pieces) || pieces.length === 0) {
    return undefined;
  }
  const pkg = pieces[0] as Record<string, unknown>;
  const tn = pkg.trackingNumber;
  return typeof tn === 'string' ? tn : undefined;
}

function parseFedexRates(data: unknown): CargoRate[] {
  if (typeof data !== 'object' || data === null) {
    return [];
  }
  const root = data as Record<string, unknown>;
  const out = root.output as Record<string, unknown> | undefined;
  const rateReplyDetails = out?.rateReplyDetails;
  if (!Array.isArray(rateReplyDetails)) {
    return [];
  }
  const rates: CargoRate[] = [];
  for (const row of rateReplyDetails) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }
    const r = row as Record<string, unknown>;
    const service = r.serviceType as string | undefined;
    const rated = r.ratedShipmentDetails;
    const first = Array.isArray(rated) ? rated[0] : rated;
    if (typeof first !== 'object' || first === null) {
      continue;
    }
    const d = first as Record<string, unknown>;
    const total = d.totalNetCharge as Record<string, unknown> | undefined;
    const amount = total?.amount;
    const price = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(price)) {
      continue;
    }
    const currency = typeof total?.currency === 'string' ? total.currency : 'TRY';
    const commit = d.commit as Record<string, unknown> | undefined;
    const days =
      typeof commit?.dateDetail?.dayFormat === 'string'
        ? Number.parseInt(commit.dateDetail.dayFormat, 10)
        : undefined;
    rates.push({
      serviceCode: service,
      serviceName: service ?? 'FedEx',
      price,
      currency,
      transitDaysMin: Number.isFinite(days) ? days : undefined,
    });
  }
  return rates;
}
