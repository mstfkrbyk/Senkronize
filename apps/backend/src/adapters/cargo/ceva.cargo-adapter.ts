import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const CEVA_CONFIG = {
  loggerName: 'CevaCargoAdapter',
  defaultBase: 'https://api.cevalogistics.com.tr/v1',
  createPath: 'shipments',
  trackPath: 'shipments/{trackingNo}/track',
  cancelPath: 'shipments/cancel',
  labelPath: 'shipments/{trackingNo}/label',
} as const;

export class CevaCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CEVA_CONFIG);
  }
}
