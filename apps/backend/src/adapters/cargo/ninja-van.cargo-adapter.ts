import type { ICargoAdapter } from '../cargo-adapter.interface';
import { RestOAuthCargoAdapter } from './cargo-rest-oauth.adapter';

const CONFIG = {
  loggerName: 'NinjaVanCargoAdapter',
  defaultBase: 'https://api.ninjavan.co/v2',
  tokenPath: 'oauth/token',
} as const;

export class NinjaVanCargoAdapter extends RestOAuthCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, CONFIG);
  }
}
