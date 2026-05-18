import { Injectable } from '@nestjs/common';

import { TrendyolAdapter } from '../trendyol/trendyol.adapter';

@Injectable()
export class TrendyolPremiumAdapter extends TrendyolAdapter {
  readonly platform: string = 'TRENDYOL_PREMIUM';

  protected override extraTrendyolHeaders(
    credentials: Record<string, string>,
  ): Record<string, string> {
    const flag = credentials.premiumFlag?.trim() || 'true';
    return { 'X-Premium-Seller': flag };
  }
}
