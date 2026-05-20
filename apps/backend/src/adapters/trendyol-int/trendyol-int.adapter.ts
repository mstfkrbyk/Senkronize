import { Injectable } from '@nestjs/common';

import { TrendyolAdapter } from '../trendyol/trendyol.adapter';
import { trendyolInternationalSupplierBaseUrl } from './trendyol-int.constants';

@Injectable()
export class TrendyolIntAdapter extends TrendyolAdapter {
  readonly platform: string = 'TRENDYOL_INT';

  protected override trendyolBaseUrl(supplierId: string): string {
    return trendyolInternationalSupplierBaseUrl(supplierId);
  }
}
