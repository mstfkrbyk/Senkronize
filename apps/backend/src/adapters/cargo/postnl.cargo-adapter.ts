import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const POSTNL_CONFIG = {
  loggerName: 'PostNlCargoAdapter',
  defaultBase: 'https://api-sandbox.postnl.nl/v1',
  createPath: 'shipments',
  trackPath: 'shipments/{trackingNo}/track',
  cancelPath: 'shipments/cancel',
  labelPath: 'shipments/{trackingNo}/label',
  apiKeyHeader: 'apikey',
} as const;

export class PostNlCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, POSTNL_CONFIG);
  }
}
