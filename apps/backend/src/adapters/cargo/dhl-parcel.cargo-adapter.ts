import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const DHL_PARCEL_CONFIG = {
  loggerName: 'DhlParcelCargoAdapter',
  defaultBase: 'https://api.dhl.com/parcel/de/v1',
  createPath: 'shipments',
  trackPath: 'shipments/{trackingNo}/tracking',
  cancelPath: 'shipments/cancel',
  labelPath: 'shipments/{trackingNo}/label',
} as const;

export class DhlParcelCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, DHL_PARCEL_CONFIG);
  }
}
