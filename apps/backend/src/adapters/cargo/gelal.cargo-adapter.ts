import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const CONFIG = {
  loggerName: 'GelalCargoAdapter',
  defaultBase: 'https://api.gelal.com/v1',
} as const;

export class GelalCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CONFIG);
  }
}
