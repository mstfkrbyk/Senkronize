import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeySecretCargoAdapter } from './cargo-rest-api-key-secret.adapter';

const CONFIG = {
  loggerName: 'FlashExpressCargoAdapter',
  defaultBase: 'https://open.flashexpress.com/v3',
} as const;

export class FlashExpressCargoAdapter extends RestApiKeySecretCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CONFIG);
  }
}
