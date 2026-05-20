import { Injectable } from '@nestjs/common';

import { SahibindenAdapter } from '../sahibinden/sahibinden.adapter';

@Injectable()
export class SahibindenPremiumAdapter extends SahibindenAdapter {
  readonly platform: string = 'SAHIBINDEN_PREMIUM';

  protected override sahibindenBaseUrl(): string {
    return 'https://api.sahibinden.com/v2/premium';
  }

  protected override rateLimitKey(): string {
    return 'SAHIBINDEN_PREMIUM';
  }
}
