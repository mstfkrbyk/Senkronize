import axios from 'axios';

import { resolveTurkeyCityCode } from '../../cargo/city-codes';
import type {
  CargoRate,
  CreateShipmentParams,
  ICargoAdapter,
  RateParams,
  ShipmentResult,
  TrackingResult,
} from '../cargo-adapter.interface';
import { escapeXml, parseXml, soap11Envelope } from './cargo-adapter.helpers';

export abstract class CargoBaseAdapter implements ICargoAdapter {
  abstract createShipment(params: CreateShipmentParams): Promise<ShipmentResult>;

  abstract trackShipment(trackingCode: string): Promise<TrackingResult>;

  abstract cancelShipment(trackingCode: string): Promise<void>;

  abstract getLabel(trackingCode: string): Promise<Buffer | null>;

  abstract getRates(params: RateParams): Promise<CargoRate[]>;

  abstract testConnection(): Promise<boolean>;

  protected constructor(protected readonly creds: Record<string, unknown>) {}

  /** Türkiye il plaka kodu (01–81); eşleşmezse boş string */
  getCityCode(cityName: string): string {
    return resolveTurkeyCityCode(cityName);
  }

  protected async postSoap(
    endpoint: string,
    soapAction: string,
    innerBody: string,
  ): Promise<unknown> {
    const { data, status } = await axios.post<string>(
      endpoint,
      soap11Envelope(innerBody),
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: soapAction,
        },
        timeout: 45_000,
        responseType: 'text',
        validateStatus: () => true,
      },
    );
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${String(status)}`);
    }
    const text = String(data);
    if (text.toLowerCase().includes('fault')) {
      throw new Error('SOAP fault');
    }
    return parseXml(text) as unknown;
  }

  protected soapEnvelopeWithNs(
    prefix: string,
    namespace: string,
    operation: string,
    fields: Record<string, string>,
  ): string {
    const tags = Object.entries(fields)
      .map(
        ([key, value]) =>
          `<${prefix}:${key}>${escapeXml(value)}</${prefix}:${key}>`,
      )
      .join('');
    return `
<${prefix}:${operation} xmlns:${prefix}="${namespace}">
${tags}
</${prefix}:${operation}>`;
  }
}
