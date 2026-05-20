import { Injectable } from '@nestjs/common';

import { TrendyolAdapter } from '../trendyol/trendyol.adapter';
import { TRENDYOL_INT_BASE_URL } from './trendyol-int.constants';

@Injectable()
export class TrendyolIntAdapter extends TrendyolAdapter {
  readonly platform: string = 'TRENDYOL_INT';

  protected override trendyolBaseUrl(): string {
    return TRENDYOL_INT_BASE_URL;
  }
}
