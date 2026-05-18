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

const BASE = 'https://api.sendeo.com.tr/v1';

export class SendeoCargoAdapter implements ICargoAdapter {
  private readonly logger = new Logger(SendeoCargoAdapter.name);

  constructor(private readonly creds: Record<string, unknown>) {}

  private headers(): Record<string, string> {
    const apiKey = requireStringField(this.creds, 'apiKey');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
  }

  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const path =
      typeof this.creds.createPath === 'string' && this.creds.createPath.length > 0
        ? this.creds.createPath
        : 'order/create';

    const body = {
      referenceCode: params.orderId,
      receiver: {
        name: params.receiverName,
        phone: params.receiverPhone,
        address: params.receiverAddress,
        city: params.receiverCity,
        district: params.receiverDistrict,
      },
      weight: params.weight,
      desi: params.desi ?? params.weight,
      note: params.notes ?? '',
    };

    const { data, status } = await axios.post<unknown>(
      `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      body,
      { headers: this.headers(), timeout: 45_000, validateStatus: () => true },
    );
    if (status < 200 || status >= 300) {
      this.logger.warn('Sendeo create HTTP hata', { status });
      throw new BadGatewayException('Sendeo gönderi oluşturma başarısız');
    }
    const code = extractTrackingCodeFromPayload(data);
    if (!code) {
      throw new BadGatewayException('Sendeo yanıtında takip numarası bulunamadı');
    }
    return { trackingCode: code };
  }

  async trackShipment(trackingCode: string): Promise<TrackingResult> {
    const path =
      typeof this.creds.trackPath === 'string' && this.creds.trackPath.length > 0
        ? this.creds.trackPath
        : 'order/track';

    const { data, status } = await axios.get<unknown>(
      `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      {
        params: { trackingNumber: trackingCode, barcode: trackingCode },
        headers: this.headers(),
        timeout: 45_000,
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('Sendeo takip sorgusu başarısız');
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
    const path =
      typeof this.creds.cancelPath === 'string' && this.creds.cancelPath.length > 0
        ? this.creds.cancelPath
        : 'order/cancel';

    const { status } = await axios.post(
      `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      { trackingNumber: trackingCode, barcode: trackingCode },
      { headers: this.headers(), timeout: 45_000, validateStatus: () => true },
    );
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('Sendeo iptal isteği başarısız');
    }
  }

  async getLabel(trackingCode: string): Promise<string | null> {
    void trackingCode;
    return null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await axios.get(`${BASE.replace(/\/$/, '')}/health`, {
        headers: this.headers(),
        timeout: 10_000,
        validateStatus: () => true,
      });
      return true;
    } catch {
      try {
        await this.trackShipment('0000000000');
        return true;
      } catch {
        return false;
      }
    }
  }
}
