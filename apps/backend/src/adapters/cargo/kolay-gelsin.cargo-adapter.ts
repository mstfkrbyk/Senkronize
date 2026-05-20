import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const KOLAY_GELSIN_CONFIG = {
  loggerName: 'KolayGelsinCargoAdapter',
  defaultBase: 'https://api.kolaygelsin.com/v1',
  createPath: 'shipments',
  trackPath: 'shipments/{trackingNo}/track',
  cancelPath: 'shipments/cancel',
  labelPath: 'shipments/{trackingNo}/label',
} as const;

export class KolayGelsinCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, KOLAY_GELSIN_CONFIG);
  }
}
