import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const CONFIG = {
  loggerName: 'KollayCargoAdapter',
  defaultBase: 'https://api.kollay.com/v1',
} as const;

export class KollayCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CONFIG);
  }
}
