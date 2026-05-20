import { Injectable } from '@nestjs/common';

import { AmazonBaseAdapter } from '../amazon/amazon-base.adapter';
import {
  AMAZON_GLOBAL_MARKETPLACE_CURRENCY,
  AMAZON_GLOBAL_MARKETPLACE_IDS,
  AMAZON_MARKETPLACE_CONFIG,
  AMAZON_SP_EU_BASE_URL,
} from '../amazon/amazon.constants';

@Injectable()
export class AmazonUkAdapter extends AmazonBaseAdapter {
  constructor() {
    super({
      platform: 'AMAZON_UK',
      spBaseUrl: AMAZON_SP_EU_BASE_URL,
      marketplaceId: AMAZON_GLOBAL_MARKETPLACE_IDS.UK,
      defaultCurrency: AMAZON_GLOBAL_MARKETPLACE_CURRENCY[AMAZON_GLOBAL_MARKETPLACE_IDS.UK] ?? 'GBP',
      awsRegion: AMAZON_MARKETPLACE_CONFIG.UK.awsRegion,
      loggerContext: AmazonUkAdapter.name,
    });
  }
}
