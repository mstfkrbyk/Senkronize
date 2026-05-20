import { BadGatewayException, Logger } from '@nestjs/common';
import axios from 'axios';

import type {
  CargoRate,
  CreateShipmentParams,
  RateParams,
  ShipmentResult,
  TrackingResult,
} from '../../cargo-adapter.interface';
import { fetchClientCredentialsToken } from '../../internal/oauth-client-credentials';
import { CargoBaseAdapter } from '../cargo-base.adapter';
import {
  extractTrackingCodeFromPayload,
  normalizeTrackingStatus,
  optionalStringField,
  requireStringField,
  singleEventFromText,
} from '../cargo-adapter.helpers';

const FEDEX_BASE = 'https://apis.fedex.com';

export class FedexCargoAdapter extends CargoBaseAdapter {
  private readonly logger = new Logger(FedexCargoAdapter.name);

  constructor(creds: Record<string, unknown>) {
    super(creds);
  }

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
    return (
      optionalStringField(this.creds, 'accountNumber') ??
      requireStringField(this.creds, 'clientId')
    );
  }

  private serviceType(): string {
    return optionalStringField(this.creds, 'serviceType') ?? 'INTERNATIONAL_PRIORITY';
  }

  private buildAddress(
    city: string,
    addressLine: string,
    postalCode?: string,
  ): Record<string, unknown> {
    return {
      streetLines: [addressLine.slice(0, 70)],
      city,
      postalCode: postalCode ?? '34000',
      countryCode: 'TR',
    };
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const token = await this.getAccessToken();
    const body = {
      labelResponseOptions: 'URL_ONLY',
      requestedShipment: {
        shipper: {
          contact: {
            personName: optionalStringField(this.creds, 'shipperName') ?? 'Shipper',
            phoneNumber:
              optionalStringField(this.creds, 'shipperPhone')?.replace(/\D/g, '').slice(0, 15) ??
              '0000000000',
          },
          address: this.buildAddress(
            optionalStringField(this.creds, 'shipperCity') ?? 'Istanbul',
            optionalStringField(this.creds, 'shipperAddress') ?? 'Merkez',
            optionalStringField(this.creds, 'shipperPostalCode'),
          ),
        },
        recipients: [
          {
            contact: {
              personName: params.receiverName,
              phoneNumber:
                params.receiverPhone.replace(/\D/g, '').slice(0, 15) || '0000000000',
            },
            address: this.buildAddress(
              params.receiverCity,
              params.receiverAddress,
              optionalStringField(this.creds, 'receiverPostalCode'),
            ),
          },
        ],
        shipDatestamp: new Date().toISOString().slice(0, 10),
        serviceType: this.serviceType(),
        packagingType: 'YOUR_PACKAGING',
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        blockInsightVisibility: false,
        rateRequestType: ['ACCOUNT'],
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
    const labelUrl = extractFedexLabelUrl(data);
    return { trackingCode: code, labelUrl };
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
    const { status } = await axios.put(
      `${FEDEX_BASE}/ship/v1/shipments/cancel`,
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
      throw new BadGatewayException('FedEx iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<Buffer | null> {
    try {
      const token = await this.getAccessToken();
      const body = {
        accountNumber: { value: this.accountNumber() },
        trackingNumber: trackingCode,
        labelSpecification: {
          imageType: 'PDF',
          labelStockType: 'PAPER_4X6',
        },
      };
      const { data, status } = await axios.post<unknown>(
        `${FEDEX_BASE}/ship/v1/shipments/packages/retrieve`,
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
        return null;
      }
      const b64 = extractFedexLabelBase64(data);
      if (b64) {
        return Buffer.from(b64, 'base64');
      }
    } catch (error) {
      this.logger.warn('FedEx etiket alınamadı', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
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
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        serviceType: this.serviceType(),
        rateRequestType: ['ACCOUNT'],
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

function extractFedexLabelUrl(data: unknown): string | undefined {
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
  const docs = pkg.packageDocuments;
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

function extractFedexLabelBase64(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const out = data as Record<string, unknown>;
  const oc = out.output as Record<string, unknown> | undefined;
  const encoded = oc?.encodedLabel ?? out.encodedLabel;
  if (typeof encoded === 'string' && encoded.length > 20) {
    return encoded;
  }
  const docs = oc?.packageDocuments ?? out.packageDocuments;
  if (!Array.isArray(docs)) {
    return undefined;
  }
  for (const doc of docs) {
    if (typeof doc !== 'object' || doc === null) {
      continue;
    }
    const content = (doc as Record<string, unknown>).encodedLabel;
    if (typeof content === 'string' && content.length > 20) {
      return content;
    }
  }
  return undefined;
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
    const dateDetail =
      commit && typeof commit.dateDetail === 'object' && commit.dateDetail !== null
        ? (commit.dateDetail as Record<string, unknown>)
        : undefined;
    const days =
      typeof dateDetail?.dayFormat === 'string'
        ? Number.parseInt(dateDetail.dayFormat, 10)
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
