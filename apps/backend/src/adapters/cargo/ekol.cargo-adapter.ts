import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const CONFIG = {
  loggerName: 'EkolCargoAdapter',
  defaultBase: 'https://api.ekol.com/v1',
} as const;

export class EkolCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CONFIG);
  }
}
