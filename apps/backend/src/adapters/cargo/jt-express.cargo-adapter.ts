import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeySecretCargoAdapter } from './cargo-rest-api-key-secret.adapter';

const CONFIG = {
  loggerName: 'JtExpressCargoAdapter',
  defaultBase: 'https://api.jtexpress.com/v2',
} as const;

export class JtExpressCargoAdapter extends RestApiKeySecretCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CONFIG);
  }
}
