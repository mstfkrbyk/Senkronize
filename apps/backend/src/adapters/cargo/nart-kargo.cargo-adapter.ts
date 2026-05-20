import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const NART_KARGO_CONFIG = {
  loggerName: 'NartKargoCargoAdapter',
  defaultBase: 'https://ws.nartkargo.com/api',
  createPath: 'shipment/create',
  trackPath: 'shipment/track/{trackingNo}',
  cancelPath: 'shipment/cancel',
  labelPath: 'shipment/label/{trackingNo}',
} as const;

export class NartKargoCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, NART_KARGO_CONFIG);
  }
}
