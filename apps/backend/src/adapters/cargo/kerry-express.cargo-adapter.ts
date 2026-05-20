import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const CONFIG = {
  loggerName: 'KerryExpressCargoAdapter',
  defaultBase: 'https://api.kerryexpress.com/v1',
} as const;

export class KerryExpressCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CONFIG);
  }
}
