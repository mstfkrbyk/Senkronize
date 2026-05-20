import { Injectable } from '@nestjs/common';

import { TrendyolAdapter } from '../trendyol/trendyol.adapter';
import { TRENDYOL_MILLA_BASE_URL } from './trendyol-milla.constants';

@Injectable()
export class TrendyolMillaAdapter extends TrendyolAdapter {
  readonly platform: string = 'TRENDYOL_MILLA';

  protected override trendyolBaseUrl(): string {
    return TRENDYOL_MILLA_BASE_URL;
  }

  protected override extraTrendyolHeaders(
    credentials: Record<string, string>,
  ): Record<string, string> {
    const channel = credentials.millaChannel?.trim() || 'milla';
    return { 'X-Trendyol-Channel': channel };
  }
}
