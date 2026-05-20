import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const CONFIG = {
  loggerName: 'DpdDeCargoAdapter',
  defaultBase: 'https://api.dpd.de/v1',
  createPath: 'shipments',
  trackPath: 'shipments/{trackingNo}/track',
  cancelPath: 'shipments/cancel',
  labelPath: 'shipments/{trackingNo}/label',
} as const;

export class DpdDeCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CONFIG);
  }
}
