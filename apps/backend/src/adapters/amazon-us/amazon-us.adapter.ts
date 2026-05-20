import { Injectable } from '@nestjs/common';

import { AmazonBaseAdapter } from '../amazon/amazon-base.adapter';
import {
  AMAZON_GLOBAL_MARKETPLACE_CURRENCY,
  AMAZON_GLOBAL_MARKETPLACE_IDS,
  AMAZON_MARKETPLACE_CONFIG,
} from '../amazon/amazon.constants';

@Injectable()
export class AmazonUsAdapter extends AmazonBaseAdapter {
  constructor() {
    super({
      platform: 'AMAZON_US',
      spBaseUrl: AMAZON_MARKETPLACE_CONFIG.US.spBaseUrl,
      marketplaceId: AMAZON_GLOBAL_MARKETPLACE_IDS.US,
      defaultCurrency:
        AMAZON_GLOBAL_MARKETPLACE_CURRENCY[AMAZON_GLOBAL_MARKETPLACE_IDS.US] ?? 'USD',
      awsRegion: AMAZON_MARKETPLACE_CONFIG.US.awsRegion,
      loggerContext: AmazonUsAdapter.name,
    });
  }
}
