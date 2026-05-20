import { Injectable } from '@nestjs/common';

import { TrendyolAdapter } from '../trendyol/trendyol.adapter';
import { TRENDYOL_SECOND_HAND_BASE_URL } from './trendyol-second-hand.constants';

@Injectable()
export class TrendyolSecondHandAdapter extends TrendyolAdapter {
  readonly platform: string = 'TRENDYOL_SECOND_HAND';

  protected override trendyolBaseUrl(): string {
    return TRENDYOL_SECOND_HAND_BASE_URL;
  }

  protected override extraTrendyolHeaders(
    credentials: Record<string, string>,
  ): Record<string, string> {
    const channel = credentials.secondHandChannel?.trim() || 'second-hand';
    return { 'X-Trendyol-Channel': channel };
  }
}
