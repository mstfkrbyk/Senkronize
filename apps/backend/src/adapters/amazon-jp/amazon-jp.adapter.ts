import { Injectable } from '@nestjs/common';

import { AmazonBaseAdapter } from '../amazon/amazon-base.adapter';
import {
  AMAZON_GLOBAL_MARKETPLACE_CURRENCY,
  AMAZON_GLOBAL_MARKETPLACE_IDS,
  AMAZON_SP_FE_BASE_URL,
} from '../amazon/amazon.constants';

@Injectable()
export class AmazonJpAdapter extends AmazonBaseAdapter {
  constructor() {
    super({
      platform: 'AMAZON_JP',
      spBaseUrl: AMAZON_SP_FE_BASE_URL,
      marketplaceId: AMAZON_GLOBAL_MARKETPLACE_IDS.JP,
      defaultCurrency: AMAZON_GLOBAL_MARKETPLACE_CURRENCY[AMAZON_GLOBAL_MARKETPLACE_IDS.JP] ?? 'JPY',
      loggerContext: AmazonJpAdapter.name,
    });
  }
}
