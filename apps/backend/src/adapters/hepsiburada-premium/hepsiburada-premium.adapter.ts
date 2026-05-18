import { Injectable } from '@nestjs/common';

import { HepsiburadaAdapter } from '../hepsiburada/hepsiburada.adapter';

@Injectable()
export class HepsiburadaPremiumAdapter extends HepsiburadaAdapter {
  readonly platform: string = 'HEPSIBURADA_PREMIUM';

  protected override extraHttpHeaders(
    credentials: Record<string, string>,
  ): Record<string, string> {
    const name = credentials.tierHeaderName?.trim() || 'X-Merchant-Tier';
    const value =
      credentials.merchantTier?.trim() ||
      credentials.tierHeaderValue?.trim() ||
      'PREMIUM';
    return { [name]: value };
  }
}
