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

const DEFAULT_BASE = 'https://customerservice.mngkargo.com.tr/mngapis/api';

export class MngCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(MngCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private baseUrl(): string {
    if (typeof this.creds.baseUrl === 'string' && this.creds.baseUrl.length > 0) {
      return this.creds.baseUrl.replace(/\/$/, '');
    }
    return DEFAULT_BASE;
  }

  private customerNumber(): string {
    if (typeof this.creds.customerNumber === 'string' && this.creds.customerNumber.length > 0) {
      return this.creds.customerNumber;
    }
    if (typeof this.creds.customerCode === 'string' && this.creds.customerCode.length > 0) {
      return this.creds.customerCode;
    }
    return requireStringField(this.creds, 'username');
  }

  private authHeader(): string {
    const customerNumber = this.customerNumber();
    const password = requireStringField(this.creds, 'password');
    const token = Buffer.from(`${customerNumber}:${password}`, 'utf8').toString('base64');
    return `Basic ${token}`;
  }

  private headersJson(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: this.authHeader(),
    };
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const path =
      typeof this.creds.createOrderPath === 'string' && this.creds.createOrderPath.length > 0
        ? this.creds.createOrderPath.replace(/^\//, '')
        : 'Barcode/CreateOrder';

    const body = {
      order: {
        referenceId: params.orderId,
        description: params.notes ?? '',
      },
      recipient: {
        customerName: params.receiverName,
        customerAddress: params.receiverAddress,
        cityName: params.receiverCity,
        districtName: params.receiverDistrict,
        phoneNumber: params.receiverPhone,
      },
      shipment: {
        weight: params.weight,
        desi: params.desi ?? params.weight,
      },
    };

    const { data, status } = await axios.post<unknown>(
      `${this.baseUrl()}/${path}`,
      body,
      {
        headers: this.headersJson(),
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('MNG CreateOrder HTTP hata', { status });
      throw new BadGatewayException('MNG Kargo gönderi oluşturma başarısız');
    }
    const code = extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException('MNG Kargo yanıtında takip numarası bulunamadı');
    }
    const labelUrl = `https://www.mngkargo.com.tr/mngkargo/kargo-takip?barcode=${encodeURIComponent(code)}`;
    return { trackingCode: code, labelUrl };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const custom =
      typeof this.creds.trackPath === 'string' && this.creds.trackPath.length > 0
        ? this.creds.trackPath
        : '';
    const path = custom
      ? custom.replaceAll('{barcode}', encodeURIComponent(trackingCode))
      : `Tracking/TrackByBarcode/${encodeURIComponent(trackingCode)}`;
    const url = `${this.baseUrl()}/${path.replace(/^\//, '')}`;

    const { data, status } = await axios.get<unknown>(url, {
      headers: { Authorization: this.authHeader() },
      timeout: 45_000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('MNG Kargo takip sorgusu başarısız');
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
    throw new BadGatewayException('MNG REST iptali bu sürümde desteklenmiyor');
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
      await axios.get(`${this.baseUrl()}/Tracking/TrackByBarcode/0000000000000`, {
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
