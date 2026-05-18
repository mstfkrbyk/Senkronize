import { Injectable } from '@nestjs/common';

import { PazaramaAdapter } from '../pazarama/pazarama.adapter';

@Injectable()
export class PazaramaPremiumAdapter extends PazaramaAdapter {
  readonly platform: string = 'PAZARAMA_PREMIUM';

  protected override extraApiHeaders(
    credentials: Record<string, string>,
  ): Record<string, string> {
    const tier =
      credentials.merchantTier?.trim() ??
      credentials.tier?.trim() ??
      'PREMIUM';
    return { 'X-Merchant-Tier': tier };
  }
}
