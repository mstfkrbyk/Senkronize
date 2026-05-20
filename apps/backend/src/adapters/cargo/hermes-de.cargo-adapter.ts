import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeySecretCargoAdapter } from './cargo-rest-api-key-secret.adapter';

const CONFIG = {
  loggerName: 'HermesDeCargoAdapter',
  defaultBase: 'https://api.myhermes.de/v1',
  createPath: 'deliveries',
  trackPath: 'deliveries/{trackingNo}/track',
  cancelPath: 'deliveries/cancel',
  labelPath: 'deliveries/{trackingNo}/label',
} as const;

export class HermesDeCargoAdapter extends RestApiKeySecretCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CONFIG);
  }
}
