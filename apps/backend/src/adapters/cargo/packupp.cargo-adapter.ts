import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const CONFIG = {
  loggerName: 'PackuppCargoAdapter',
  defaultBase: 'https://api.packupp.com/v1',
} as const;

export class PackuppCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CONFIG);
  }
}
